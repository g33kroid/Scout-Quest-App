import "server-only";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import { pickNextUnlock, type JournalQuest } from "@/lib/journal-helpers";

export type { JournalQuest } from "@/lib/journal-helpers";
export type BoardState = "available" | "locked" | "completed" | "expired";

export interface JournalSections {
  active: JournalQuest[];
  locked: JournalQuest[];
  completed: JournalQuest[];
  missed: JournalQuest[];
}

// Five sections, all derived — no denormalised journal table
// (docs/tasks/10-journal.md). Active/Locked/Completed/Missed come straight
// from quest_board_state (Task 09); Achievements is a Wave 1 placeholder,
// nothing to derive yet.
//
// quest_board_state is a VIEW, not a table — PostgREST can't infer a
// relationship to embed `quests(...)` through it (embedding needs a real FK
// constraint, which views don't carry). So this fetches the board, then
// quests/translations for just those ids, and joins client-side — the same
// shape as getRosterForSession (lib/server/leader-roster.ts).
export async function getJournalSections(): Promise<JournalSections | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: board } = await supabase
    .from("quest_board_state")
    .select("quest_id, state, unmet_prereq_ids")
    .eq("person_id", user.id)
    .returns<
      { quest_id: string; state: BoardState; unmet_prereq_ids: string[] | null }[]
    >();
  const rows = board ?? [];
  if (rows.length === 0) {
    return { active: [], locked: [], completed: [], missed: [] };
  }

  const questIds = rows.map((r) => r.quest_id);
  const { data: quests } = await supabase
    .from("quests")
    .select("id, tier, kind, quest_translations(locale, title, flavour)")
    .in("id", questIds);
  const questById = new Map(
    (quests ?? []).map((q) => [
      q.id,
      {
        tier: q.tier as string,
        kind: q.kind as "solo" | "group",
        en: (
          q.quest_translations as {
            locale: string;
            title: string;
            flavour: string | null;
          }[]
        ).find((t) => t.locale === "en"),
      },
    ]),
  );

  // Locked quests name their unmet prerequisites — resolve every id
  // referenced across the whole board in one query rather than one per row.
  const allUnmetIds = Array.from(new Set(rows.flatMap((r) => r.unmet_prereq_ids ?? [])));
  const titleById = new Map<string, string>();
  if (allUnmetIds.length > 0) {
    const { data: prereqTranslations } = await supabase
      .from("quest_translations")
      .select("quest_id, title")
      .eq("locale", "en")
      .in("quest_id", allUnmetIds);
    for (const row of prereqTranslations ?? []) {
      titleById.set(row.quest_id, row.title);
    }
  }

  const completedQuestIds = rows
    .filter((r) => r.state === "completed")
    .map((r) => r.quest_id);
  const completionByQuestId = new Map<
    string,
    { completedAt: string; pointsEarned: number }
  >();
  if (completedQuestIds.length > 0) {
    const { data: completions } = await supabase
      .from("journal_completed")
      .select("quest_id, completed_at, points_earned")
      .eq("person_id", user.id)
      .in("quest_id", completedQuestIds);
    for (const row of completions ?? []) {
      completionByQuestId.set(row.quest_id, {
        completedAt: row.completed_at,
        pointsEarned: row.points_earned,
      });
    }
  }

  const sections: JournalSections = { active: [], locked: [], completed: [], missed: [] };

  for (const row of rows) {
    const quest = questById.get(row.quest_id);
    if (!quest) continue;
    const completion = completionByQuestId.get(row.quest_id);
    const isGroupCompleted = row.state === "completed" && quest.kind === "group";

    let teammateCount: number | null = null;
    if (isGroupCompleted) {
      const { data } = await supabase.rpc("journal_completed_teammate_count", {
        p_person_id: user.id,
        p_quest_id: row.quest_id,
      });
      teammateCount = data ?? 0;
    }

    const journalQuest: JournalQuest = {
      questId: row.quest_id,
      title: quest.en?.title ?? "(untitled)",
      flavour: quest.en?.flavour ?? null,
      tier: quest.tier,
      kind: quest.kind,
      unmetPrereqTitles: (row.unmet_prereq_ids ?? []).map(
        (id) => titleById.get(id) ?? "(unnamed quest)",
      ),
      completedAt: completion?.completedAt ?? null,
      pointsEarned: completion?.pointsEarned ?? null,
      teammateCount,
    };

    if (row.state === "available") sections.active.push(journalQuest);
    else if (row.state === "locked") sections.locked.push(journalQuest);
    else if (row.state === "completed") sections.completed.push(journalQuest);
    else sections.missed.push(journalQuest);
  }

  return sections;
}

export interface HomeScreenData {
  streak: number;
  totalPoints: number;
  patrolTotal: number | null;
  recentActivity: { title: string; pointsEarned: number; completedAt: string }[];
  nextUnlock: { title: string; unmetPrereqTitles: string[] } | null;
}

// docs/tasks/10-journal.md: "own streak, own recent activity, patrol
// contribution, next unlock" — rankings are never the landing view, so this
// deliberately never queries a leaderboard/rank.
export async function getHomeScreenData(): Promise<HomeScreenData | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: streak }, { data: totals }, { data: membership }, sections] =
    await Promise.all([
      supabase.rpc("attendance_streak", { p_person_id: user.id }),
      supabase
        .from("person_totals")
        .select("total")
        .eq("person_id", user.id)
        .maybeSingle(),
      supabase
        .from("patrol_memberships")
        .select("patrol_id")
        .eq("person_id", user.id)
        .is("ended_at", null)
        .maybeSingle(),
      getJournalSections(),
    ]);

  let patrolTotal: number | null = null;
  if (membership?.patrol_id) {
    const { data } = await supabase.rpc("patrol_total_for_scout", {
      p_patrol_id: membership.patrol_id,
    });
    patrolTotal = data ?? null;
  }

  const recentActivity = (sections?.completed ?? [])
    .filter((q): q is JournalQuest & { completedAt: string; pointsEarned: number } =>
      Boolean(q.completedAt),
    )
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 3)
    .map((q) => ({
      title: q.title,
      pointsEarned: q.pointsEarned,
      completedAt: q.completedAt,
    }));

  const nextUnlockQuest = pickNextUnlock(sections?.locked ?? []);

  return {
    streak: streak ?? 0,
    totalPoints: totals?.total ?? 0,
    patrolTotal,
    recentActivity,
    nextUnlock: nextUnlockQuest
      ? {
          title: nextUnlockQuest.title,
          unmetPrereqTitles: nextUnlockQuest.unmetPrereqTitles,
        }
      : null,
  };
}
