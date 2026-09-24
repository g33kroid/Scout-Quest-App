import "server-only";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import type { QuestKind, QuestOption, QuestTier } from "@/lib/quest-shared";

export { TIER_POINTS } from "@/lib/quest-shared";
export type { QuestKind, QuestOption, QuestTier } from "@/lib/quest-shared";

export interface QuestTranslation {
  locale: "en" | "ar";
  title: string;
  flavour: string | null;
  description: string;
}

export interface AuthoredQuest {
  id: string;
  tier: QuestTier;
  kind: QuestKind;
  publishedAt: string | null;
  expiresAt: string | null;
  translations: QuestTranslation[];
  prereqIds: string[];
}

export interface LeaderIdentity {
  unitId: string;
  personId: string;
}

// Shared by every leader-authoring data/action function (also used from
// app/leader/quests/actions.ts) — one lookup of "who is this leader and
// which unit do they lead" rather than reimplementing it per call site.
export async function getLeaderIdentity(): Promise<LeaderIdentity | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: leaderRow } = await supabase
    .from("leaders")
    .select("unit_id")
    .eq("person_id", user.id)
    .maybeSingle();
  if (!leaderRow?.unit_id) return null;
  return { unitId: leaderRow.unit_id, personId: user.id };
}

// Every quest in the leader's own unit, published or not — RLS
// (quests_select) already scopes this; is_admin_or_leader_of(unit_id) also
// grants a leader every quest_prereqs/quest_translations row for it.
export async function getQuestsForLeaderUnit(): Promise<AuthoredQuest[]> {
  const leader = await getLeaderIdentity();
  if (!leader) return [];
  const unitId = leader.unitId;

  const supabase = await createServerSupabaseClient();
  const { data: quests } = await supabase
    .from("quests")
    .select(
      "id, tier, kind, published_at, expires_at, quest_translations(locale, title, flavour, description), quest_prereqs!quest_prereqs_quest_id_fkey(requires_quest_id)",
    )
    .eq("unit_id", unitId)
    .order("published_at", { ascending: false, nullsFirst: true });

  return (quests ?? []).map((q) => ({
    id: q.id,
    tier: q.tier as QuestTier,
    kind: q.kind as QuestKind,
    publishedAt: q.published_at,
    expiresAt: q.expires_at,
    translations: (q.quest_translations ?? []) as QuestTranslation[],
    prereqIds: ((q.quest_prereqs ?? []) as { requires_quest_id: string }[]).map(
      (p) => p.requires_quest_id,
    ),
  }));
}

// Candidate prerequisites for a picker: every other quest in the unit,
// labelled by its English title (falls back to the id if untranslated yet —
// a draft quest can be a prerequisite before it has any translation).
export async function getPrereqOptions(excludeQuestId?: string): Promise<QuestOption[]> {
  const leader = await getLeaderIdentity();
  if (!leader) return [];
  const unitId = leader.unitId;

  const supabase = await createServerSupabaseClient();
  const { data: quests } = await supabase
    .from("quests")
    .select("id, quest_translations(locale, title)")
    .eq("unit_id", unitId);

  return (quests ?? [])
    .filter((q) => q.id !== excludeQuestId)
    .map((q) => {
      const translations = (q.quest_translations ?? []) as {
        locale: string;
        title: string;
      }[];
      const en = translations.find((t) => t.locale === "en");
      return { id: q.id, title: en?.title ?? "(untitled draft)" };
    });
}
