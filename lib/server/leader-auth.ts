import "server-only";
import { headers, cookies } from "next/headers";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "@/lib/server/otp";
import { getWhatsAppSender } from "@/lib/server/whatsapp-sender";
import {
  OTP_VERIFIED_COOKIE_NAME,
  createOtpVerifiedCookie,
  isOtpVerifiedCookieValid,
} from "@/lib/server/otp-session";

export type LeaderLoginResult =
  { ok: false; reason: "locked" | "invalid_credentials" } | { ok: true };

// Step 1: email + password only. Supabase Auth owns the credential itself;
// we only own the per-IP lockout and the audit trail on top of it.
export async function loginLeaderPassword(
  email: string,
  password: string,
  ip: string,
): Promise<LeaderLoginResult> {
  const admin = createAdminClient();

  const { data: isLocked } = await admin.rpc("leader_login_is_locked", { p_ip: ip });
  if (isLocked) {
    return { ok: false, reason: "locked" };
  }

  const serverClient = await createServerSupabaseClient();
  const { error } = await serverClient.auth.signInWithPassword({ email, password });

  await admin.rpc("leader_login_record", { p_email: email, p_ip: ip, p_success: !error });

  if (error) {
    return { ok: false, reason: "invalid_credentials" };
  }
  return { ok: true };
}

export type LeaderSessionState =
  | { status: "unauthenticated" }
  | { status: "needs_whatsapp_setup" }
  | { status: "needs_otp_challenge"; personId: string }
  | { status: "ready" };

// The single source of truth for "can this session reach a leader route
// right now" — used by the login page, the OTP-setup/verify pages, and
// proxy.ts (the route guard). Second factor is a WhatsApp-delivered OTP,
// not authenticator-app TOTP — see the PR that introduced this file for
// why (a deliberate post-Task-03 decision, not part of the original plan).
// "Mandatory" means an unenrolled leader gets routed to setup, not locked
// out forever with no path forward — same shape as the TOTP flow it
// replaces.
export async function getLeaderSessionState(): Promise<LeaderSessionState> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: whatsappNumber } = await supabase.rpc("leader_get_own_whatsapp_number");
  if (!whatsappNumber) {
    return { status: "needs_whatsapp_setup" };
  }

  const cookieStore = await cookies();
  const otpCookie = cookieStore.get(OTP_VERIFIED_COOKIE_NAME)?.value;
  if (await isOtpVerifiedCookieValid(otpCookie, user.id)) {
    return { status: "ready" };
  }

  return { status: "needs_otp_challenge", personId: user.id };
}

const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export type SetWhatsAppNumberResult = { ok: true } | { ok: false; error: string };

export async function setLeaderWhatsAppNumber(
  whatsappNumber: string,
): Promise<SetWhatsAppNumberResult> {
  if (!E164_PATTERN.test(whatsappNumber)) {
    return {
      ok: false,
      error: "Enter a number in international format, e.g. +9715XXXXXXXX.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("leader_set_whatsapp_number", {
    p_whatsapp_number: whatsappNumber,
  });
  if (error) {
    return { ok: false, error: "Could not save that number. Try again." };
  }
  return { ok: true };
}

export type SendOtpResult = { ok: true } | { ok: false; error: string };

// Generates a fresh code, stores its hash, and sends it — called when the
// leader lands on the OTP-challenge step, and again if they tap "resend".
export async function sendLeaderOtpChallenge(personId: string): Promise<SendOtpResult> {
  const supabase = await createServerSupabaseClient();

  const { data: whatsappNumber } = await supabase.rpc("leader_get_own_whatsapp_number");
  if (!whatsappNumber) {
    return { ok: false, error: "No WhatsApp number on file." };
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);

  const { error } = await supabase.rpc("leader_generate_otp_challenge", {
    p_person_id: personId,
    p_code_hash: codeHash,
  });
  if (error) {
    return { ok: false, error: "Could not start verification. Try again." };
  }

  const sendResult = await getWhatsAppSender().sendMessage(
    whatsappNumber,
    `Your Scout Quest verification code is ${code}. It expires in 5 minutes.`,
  );
  if (!sendResult.ok) {
    return { ok: false, error: "Could not send the code. Try again." };
  }
  return { ok: true };
}

export type VerifyOtpResult =
  { ok: true } | { ok: false; reason: "locked" | "invalid_code" | "no_active_challenge" };

export async function verifyLeaderOtp(
  personId: string,
  code: string,
  ip: string,
): Promise<VerifyOtpResult> {
  const supabase = await createServerSupabaseClient();

  const { data: isLocked } = await supabase.rpc("leader_otp_is_locked", {
    p_person_id: personId,
    p_ip: ip,
  });
  if (isLocked) {
    return { ok: false, reason: "locked" };
  }

  const { data: challenges } = await supabase.rpc("leader_get_active_otp_challenge", {
    p_person_id: personId,
  });
  const challenge = challenges?.[0] as { id: string; code_hash: string } | undefined;
  if (!challenge) {
    return { ok: false, reason: "no_active_challenge" };
  }

  const matches = await verifyOtpCode(challenge.code_hash, code);

  await supabase.rpc("leader_otp_verify_record", {
    p_challenge_id: challenge.id,
    p_ip: ip,
    p_success: matches,
  });

  if (!matches) {
    return { ok: false, reason: "invalid_code" };
  }

  const cookieStore = await cookies();
  const { value, maxAgeSeconds } = await createOtpVerifiedCookie(personId);
  cookieStore.set(OTP_VERIFIED_COOKIE_NAME, value, {
    httpOnly: true,
    // Browsers refuse a Secure cookie over plain HTTP — true in prod
    // (always HTTPS, Task 15), false in dev/CI/LAN testing (always HTTP).
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSeconds,
    path: "/",
  });

  return { ok: true };
}

// Reused by leaderLoginAction so it doesn't need to duplicate header
// parsing for the client IP.
export async function getRequestIp(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
}
