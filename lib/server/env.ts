// ponytail: fails fast at import time so a missing server secret surfaces at
// boot, not mid-request. Add new server-only vars here, never read
// process.env directly outside this file.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server env var: ${name}`);
  }
  return value;
}

export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Signs the leader_otp_verified cookie (lib/server/otp-session.ts). Reuses
// the JWT secret rather than adding a new required env var — both are
// server-only, HMAC-signing values nobody but this app ever verifies.
export function getOtpSessionSecret(): string {
  return requireEnv("SUPABASE_JWT_SECRET");
}

// Not requireEnv: unlike the vars above, the app runs fine with this unset
// (E2E_TEST_MODE's stub translator never calls it, and a real deploy without
// it just means "Translate" degrades to a friendly error) — lib/server/
// translator.ts is what actually treats a missing key as its own failure
// mode, at call time, not at import/boot time.
export function getLlmApiKey(): string {
  return process.env.LLM_API_KEY ?? "";
}
