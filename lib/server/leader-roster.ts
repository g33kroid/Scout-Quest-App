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

export type AttendanceStatus = "present" | "absent" | "excused";

export interface RosterScout {
  personId: string;
  displayName: string;
  awardedToday: boolean;
  // null: nobody has recorded anything for this session yet. Distinct from
  // 'absent' — a session that hasn't closed isn't a no-show yet
  // (docs/tasks/06-attendance.md); the DB only defaults to absent once the
  // session is in the past (see attendance_resolved).
  attendanceStatus: AttendanceStatus | null;
}

export interface AttentionScout {
  personId: string;
  displayName: string;
  totalAbsences: number;
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

  // attendance_current (Task 06): the latest row per (person, session) —
  // append-only, so this is never a plain table select.
  const { data: attendance } = await supabase
    .from("attendance_current")
    .select("person_id, status")
    .eq("session_id", sessionId);
  const statusByPerson = new Map(
    (attendance ?? []).map((row) => [row.person_id, row.status as AttendanceStatus]),
  );

  return (enrollments ?? [])
    .map((row) => {
      const person = Array.isArray(row.people) ? row.people[0] : row.people;
      return {
        personId: row.person_id,
        displayName: person?.display_name ?? "",
        awardedToday: awardedIds.has(row.person_id),
        attendanceStatus: statusByPerson.get(row.person_id) ?? null,
      };
    })
    .filter((scout) => scout.displayName)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// The pastoral signal (docs/tasks/06-attendance.md): scouts with 2+ total
// absences, regardless of reason — attendance_rates.needs_attention already
// does the counting, RLS already scopes it to this leader's own unit.
export async function getAttentionNeededScouts(
  personIds: string[],
): Promise<AttentionScout[]> {
  if (personIds.length === 0) return [];
  const supabase = await createServerSupabaseClient();

  const { data: rates } = await supabase
    .from("attendance_rates")
    .select("person_id, total_absences, needs_attention")
    .in("person_id", personIds)
    .eq("needs_attention", true);
  if (!rates || rates.length === 0) return [];

  const { data: people } = await supabase
    .from("people")
    .select("id, display_name")
    .in(
      "id",
      rates.map((r) => r.person_id),
    );
  const nameById = new Map((people ?? []).map((p) => [p.id, p.display_name]));

  return rates
    .map((r) => ({
      personId: r.person_id,
      displayName: nameById.get(r.person_id) ?? "",
      totalAbsences: r.total_absences,
    }))
    .filter((s) => s.displayName)
    .sort((a, b) => b.totalAbsences - a.totalAbsences);
}
