import "server-only";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";

export type LeaderLoginResult =
  { ok: false; reason: "locked" | "invalid_credentials" } | { ok: true };

// Step 1: email + password only. Supabase Auth owns the credential itself
// (docs/tasks/03-auth.md — leaders use Supabase Auth directly); we only own
// the per-IP lockout and the audit trail on top of it.
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
  | { status: "needs_enrollment" }
  | { status: "needs_mfa_challenge"; factorId: string }
  | { status: "ready" };

// The single source of truth for "can this session reach a leader route
// right now" — used by both the login page (what to show next) and the
// route guard (what to block). docs/tasks/03-auth.md: "a leader without
// TOTP enrolled cannot reach any leader route" and "mandatory TOTP" —
// mandatory means unenrolled leaders get routed to enrollment, not locked
// out forever with no path forward.
export async function getLeaderSessionState(): Promise<LeaderSessionState> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === "verified");

  if (!verifiedTotp) {
    return { status: "needs_enrollment" };
  }

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel === "aal2") {
    return { status: "ready" };
  }

  return { status: "needs_mfa_challenge", factorId: verifiedTotp.id };
}

// GoTrue only returns a factor's QR/secret once, at enroll() time, and
// rejects a second enroll() call outright ("factor with the friendly name
// already exists" — the default friendly name is always the empty string).
// A leader reloading this page mid-setup is a real, expected case, not an
// edge case — clear out any stale unverified factor first so enroll() can
// succeed again and the leader gets a fresh, scannable QR code.
export async function enrollLeaderTotp() {
  const supabase = await createServerSupabaseClient();

  // listFactors()'s type-keyed arrays (.totp, .phone, ...) only ever contain
  // VERIFIED factors — an unverified one shows up in .all and nowhere else.
  // Filtering .totp here (as an earlier version of this function did) finds
  // nothing, never actually cleans anything up, and this function keeps
  // failing with the same name-conflict error forever.
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const pending =
    factorsData?.all?.filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    ) ?? [];
  for (const factor of pending) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  return supabase.auth.mfa.enroll({ factorType: "totp" });
}

// Confirms enrollment (first verify after enroll()) and post-enrollment
// challenges (every later login) use the same call — Supabase Auth doesn't
// distinguish them.
export async function verifyLeaderTotp(factorId: string, code: string) {
  const supabase = await createServerSupabaseClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError || !challenge) {
    return { ok: false as const };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  return { ok: !verifyError };
}
