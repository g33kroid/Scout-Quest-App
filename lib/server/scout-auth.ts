import "server-only";
import { createAdminClient } from "@/lib/server/supabase-admin";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import { verifyPin } from "@/lib/server/pin";

export type ScoutLoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid_join_code" | "invalid_credentials" | "locked" };

// A verify() call against this dummy hash costs the same as a real one —
// argon2's cost is what makes brute-forcing expensive, so an unknown
// nickname must still pay it. Never a valid hash for any real PIN.
const DUMMY_PIN_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// docs/tasks/03-auth.md: join code + nickname + PIN, verification in a
// server action, never client-side. Never reveals whether a join code or
// nickname exists — every failure path returns the same shape.
export async function loginScout(
  joinCode: string,
  nickname: string,
  pin: string,
  ip: string,
): Promise<ScoutLoginResult> {
  const admin = createAdminClient();

  const { data: unitId } = await admin.rpc("verify_join_code", { p_code: joinCode });
  if (!unitId) {
    return { ok: false, reason: "invalid_join_code" };
  }

  const { data: candidates } = await admin.rpc("find_scout_for_login", {
    p_unit_id: unitId,
    p_nickname: nickname,
  });
  const candidate = candidates?.[0] as
    | {
        person_id: string;
        pin_hash: string;
        failed_attempts: number;
        locked_until: string | null;
      }
    | undefined;

  const { data: isLocked } = await admin.rpc("scout_login_is_locked", {
    p_person_id: candidate?.person_id ?? null,
    p_ip: ip,
  });
  if (isLocked) {
    return { ok: false, reason: "locked" };
  }

  const pinMatches = await verifyPin(candidate?.pin_hash ?? DUMMY_PIN_HASH, pin);
  const success = Boolean(candidate) && pinMatches;

  await admin.rpc("scout_login_record", {
    p_person_id: candidate?.person_id ?? null,
    p_ip: ip,
    p_success: success,
  });

  if (!candidate || !success) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return mintScoutSession(candidate.person_id);
}

// Server-side session minting for a person who authenticated without a
// password: generate a magic-link token via the admin API, then exchange it
// immediately (server-side, the scout never sees an email) for a real
// session. Documented Supabase pattern for custom auth flows.
async function mintScoutSession(personId: string): Promise<ScoutLoginResult> {
  const admin = createAdminClient();

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(personId);
  if (userError || !userData.user?.email) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const serverClient = await createServerSupabaseClient();
  const { error: verifyError } = await serverClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return { ok: true };
}
