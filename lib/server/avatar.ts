import "server-only";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import { parseAvatarConfig, resolveAvatarConfig, type AvatarConfig } from "@/lib/avatar";

export interface OwnAvatar {
  // The scout's opaque id — also the seed for the deterministic default.
  seed: string;
  config: AvatarConfig;
}

// The current scout's avatar: their saved config if usable, otherwise the
// deterministic default seeded from their id (docs/tasks/12-avatar.md: "a new
// scout gets a deterministic default avatar from their id"). Null when nobody
// is signed in.
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

  return {
    seed: user.id,
    config: resolveAvatarConfig(user.id, person?.avatar_config),
  };
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
