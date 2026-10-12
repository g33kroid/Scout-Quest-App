import "server-only";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import { parseAvatarConfig, type ValidatedAvatarConfig } from "@/lib/avatar";

export interface OwnAvatar {
  // The scout's opaque id — the client uses it as the seed for the
  // deterministic default when `config` is null.
  seed: string;
  // Saved config, or null for "not set yet" (rendered as the seeded default).
  config: ValidatedAvatarConfig | null;
}

// The current scout's avatar seed + saved config. The default is NOT resolved
// here: genConfig lives in the client-only island (react-nice-avatar is
// server-hostile), so the client seeds the default from `seed`. Null when
// nobody is signed in.
export async function getOwnAvatar(): Promise<OwnAvatar | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: person } = await supabase
    .from("people")
    .select("avatar_config")
    .eq("id", user.id)
    .maybeSingle();

  return { seed: user.id, config: parseAvatarConfig(person?.avatar_config) };
}

// set_own_avatar_config() is the only write path onto people.avatar_config —
// see supabase/migrations/20261012120000_task12_set_own_avatar_config.sql.
// Validates shape here (convenience); the DB function is the floor. Returns
// false on an invalid config or no session, true once the write is issued.
export async function setOwnAvatarConfig(input: unknown): Promise<boolean> {
  const config = parseAvatarConfig(input);
  if (!config) return false;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.rpc("set_own_avatar_config", {
    p_config: config,
  });
  return !error;
}
