// docs/tasks/07-qr-checkin.md: a TOTP-style rotating token, verified fully
// offline on both the scout's device (generating) and the leader's device
// (verifying against a locally cached roster of secrets — no server round
// trip). Runs in the browser, so Web Crypto (`crypto.subtle`), not a
// Node-only crypto module — this file must stay isomorphic.
//
// Payload shape: `<opaqueId>.<counter>.<mac>` — never the real person_id,
// never a name, never a unit. `mac` is HMAC-SHA256(secret, opaqueId:counter)
// truncated to 10 bytes (20 hex chars) — plenty of forgery resistance for a
// 30-second-lived token, and keeps the QR code small enough to scan fast.

const WINDOW_SECONDS = 30;
const MAC_BYTES = 10;

export function currentCounter(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / WINDOW_SECONDS);
}

async function hmac(secret: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    secret as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return new Uint8Array(signature).slice(0, MAC_BYTES);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time comparison — a timing side-channel on MAC verification would
// let an attacker recover it byte-by-byte.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function generateQrPayload(
  secret: Uint8Array,
  opaqueId: string,
  nowMs: number = Date.now(),
): Promise<string> {
  const counter = currentCounter(nowMs);
  const mac = await hmac(secret, `${opaqueId}:${counter}`);
  return `${opaqueId}.${counter}.${toHex(mac)}`;
}

export type VerifyResult =
  | { ok: true; opaqueId: string }
  | { ok: false; reason: "malformed" | "unknown_scout" | "expired" | "tampered" };

// `lookupSecret` is the leader's locally cached roster (opaqueId -> secret).
// Returning undefined for a scout outside the leader's unit is exactly what
// makes that case indistinguishable from "unknown" — there is no secret to
// even attempt verification with, by construction (docs/tasks/07-qr-checkin.md:
// "a token for a scout outside the leader's unit is rejected").
export async function verifyQrPayload(
  payload: string,
  lookupSecret: (opaqueId: string) => Uint8Array | undefined,
  nowMs: number = Date.now(),
): Promise<VerifyResult> {
  const parts = payload.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [opaqueId, counterStr, mac] = parts;
  const counter = Number(counterStr);
  if (!opaqueId || !Number.isInteger(counter) || !/^[0-9a-f]{20}$/.test(mac)) {
    return { ok: false, reason: "malformed" };
  }

  const secret = lookupSecret(opaqueId);
  if (!secret) return { ok: false, reason: "unknown_scout" };

  // ±1 window for clock skew — a token more than one window old or from the
  // future is rejected outright before any MAC comparison.
  const nowCounter = currentCounter(nowMs);
  if (Math.abs(counter - nowCounter) > 1) return { ok: false, reason: "expired" };

  const expectedMac = toHex(await hmac(secret, `${opaqueId}:${counter}`));
  if (!timingSafeEqual(mac, expectedMac)) return { ok: false, reason: "tampered" };

  return { ok: true, opaqueId };
}
