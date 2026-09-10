"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";

// Shape-only check (8-4-4-4-12 hex), not zod's stricter `.uuid()` — that
// enforces the RFC4122 version/variant nibbles, which our own
// uuid_generate_v7() rows always satisfy but which is a needlessly strict
// gate here: Postgres itself rejects a malformed uuid at the RPC's own
// type-cast boundary regardless, and RLS + award_points()'s own
// authorisation check are the real boundary either way (docs/spec.md).
const uuidShape = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const schema = z.object({
  sessionId: uuidShape,
  personIds: z.array(uuidShape).min(1),
  tier: z.enum(["minor", "standard", "major", "epic"]),
  idempotencyKey: z.string().min(1),
});

export interface AwardPointsResult {
  ok: boolean;
  error?: string;
}

// Calls award_points() as the leader's own authenticated session, never the
// admin client — the function's own authorisation check (is_admin_or_leader_of,
// via current_uid()) depends on who's actually calling it. Tier -> points
// mapping lives entirely server-side inside that function; this action never
// sees or passes a raw point number (docs/tasks/04-ledger.md).
export async function awardPointsAction(input: {
  sessionId: string;
  personIds: string[];
  tier: string;
  idempotencyKey: string;
}): Promise<AwardPointsResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid selection." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("award_points", {
    p_person_ids: parsed.data.personIds,
    p_tier: parsed.data.tier,
    p_reason: "award",
    p_quest_id: null,
    p_session_id: parsed.data.sessionId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error) {
    return { ok: false, error: "Could not save that award. Try again." };
  }
  return { ok: true };
}
