import "server-only";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";

// docs/tasks/05-leader-scoring.md: "Leader home route resolves the current
// context server-side: today's session for their unit... No picker if there
// is exactly one candidate." Camp-station assignment (the other half of
// that sentence) is Wave 3 — docs/spec.md explicitly excludes the camp
// designer/camp teams from Wave 1 — so this resolves unit sessions only.

export interface SessionSummary {
  id: string;
  scheduledAt: string;
  unitId: string;
}

export interface RosterScout {
  personId: string;
  displayName: string;
  awardedToday: boolean;
}

// Uses the leader's own authenticated client — RLS (Task 02) already scopes
// `sessions`/`people`/`unit_enrollments`/`ledger` reads to the leader's own
// unit, so no service-role client and no extra authorization logic needed
// here beyond what RLS already enforces.
export async function getTodaysSessionsForLeader(): Promise<SessionSummary[]> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: leaderRow } = await supabase
    .from("leaders")
    .select("unit_id")
    .eq("person_id", user.id)
    .maybeSingle();
  if (!leaderRow?.unit_id) return [];

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, scheduled_at, unit_id")
    .eq("unit_id", leaderRow.unit_id)
    .gte("scheduled_at", startOfDay.toISOString())
    .lt("scheduled_at", endOfDay.toISOString())
    .order("scheduled_at", { ascending: true });

  return (sessions ?? []).map((s) => ({
    id: s.id,
    scheduledAt: s.scheduled_at,
    unitId: s.unit_id,
  }));
}

// Roster for one session: every scout actively enrolled in that session's
// unit, plus whether they've already been awarded points tied to this
// specific session (so a leader can see at a glance who's still unscored).
export async function getRosterForSession(sessionId: string): Promise<RosterScout[]> {
  const supabase = await createServerSupabaseClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("unit_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return [];

  const { data: enrollments } = await supabase
    .from("unit_enrollments")
    .select("person_id, people(display_name)")
    .eq("unit_id", session.unit_id)
    .is("ended_at", null);

  const { data: awarded } = await supabase
    .from("ledger")
    .select("person_id")
    .eq("session_id", sessionId)
    .eq("reason", "award");
  const awardedIds = new Set((awarded ?? []).map((row) => row.person_id));

  return (enrollments ?? [])
    .map((row) => {
      const person = Array.isArray(row.people) ? row.people[0] : row.people;
      return {
        personId: row.person_id,
        displayName: person?.display_name ?? "",
        awardedToday: awardedIds.has(row.person_id),
      };
    })
    .filter((scout) => scout.displayName)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
