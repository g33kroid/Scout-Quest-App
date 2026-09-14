// No "server-only" import — this module runs in the Edge runtime (proxy.ts,
// the route guard) as well as in Node server actions, so it stays
// runtime-agnostic: Web Crypto only, same reasoning as lib/qr-token.ts.
import { getOtpSessionSecret } from "@/lib/server/env";

export const OTP_VERIFIED_COOKIE_NAME = "leader_otp_verified";

// 12 hours — long enough that a leader isn't re-challenged mid-class,
// short enough that a stolen cookie doesn't grant standing access.
const TTL_MS = 12 * 60 * 60 * 1000;

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getOtpSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Called once, right after a successful OTP verify. The cookie binds to
// this person_id specifically — proxy.ts checks it against the *current*
// Supabase session's user id, so the cookie alone (without a valid
// Supabase session for the same person) grants nothing.
export async function createOtpVerifiedCookie(
  personId: string,
): Promise<{ value: string; maxAgeSeconds: number }> {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${personId}.${expiresAt}`;
  const mac = await hmac(payload);
  return { value: `${payload}.${mac}`, maxAgeSeconds: Math.floor(TTL_MS / 1000) };
}

export async function isOtpVerifiedCookieValid(
  cookieValue: string | undefined,
  personId: string,
): Promise<boolean> {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [cookiePersonId, expiresAtRaw, mac] = parts;
  if (cookiePersonId !== personId) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expectedMac = await hmac(`${cookiePersonId}.${expiresAtRaw}`);
  return timingSafeEqual(mac, expectedMac);
}
