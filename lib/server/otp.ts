import "server-only";
import { hashPin, verifyPin } from "@/lib/server/pin";

// Same argon2id hashing as a scout PIN — a 6-digit OTP code deserves the
// same treatment (never stored or logged in plaintext), the naming in
// pin.ts is just historical. `crypto.getRandomValues`, not Math.random —
// this is a credential, not a UI id.
export function generateOtpCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

export function hashOtpCode(code: string): Promise<string> {
  return hashPin(code);
}

export function verifyOtpCode(codeHash: string, code: string): Promise<boolean> {
  return verifyPin(codeHash, code);
}
