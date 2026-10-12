"use server";

import { setOwnAvatarConfig } from "@/lib/server/avatar";

// Thin Server Action wrapper so the client customiser
// (app/scout/avatar/avatar-editor.tsx) can persist a config directly.
// lib/server/avatar.ts itself isn't "use server" — it's a server-only helper
// other server code (Server Components) also calls. Returns whether the save
// was accepted, so the editor can surface a failure instead of silently
// pretending it saved.
export async function setAvatarConfigAction(config: unknown): Promise<boolean> {
  return setOwnAvatarConfig(config);
}
