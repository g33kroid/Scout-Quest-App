"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import { getLeaderIdentity } from "@/lib/server/quest-authoring";
import { friendlyDbError } from "@/lib/db-error-messages";
import { getTranslator } from "@/lib/server/translator";

const uuidShape = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const tierSchema = z.enum(["minor", "standard", "major", "epic"]);
const kindSchema = z.enum(["solo", "group"]);

export interface QuestActionResult {
  ok: boolean;
  error?: string;
  questId?: string;
}

const createSchema = z.object({
  tier: tierSchema,
  kind: kindSchema,
  titleEn: z.string().min(1).max(120),
  descriptionEn: z.string().min(1).max(2000),
  flavourEn: z.string().max(280).nullable().optional(),
  titleAr: z.string().max(120).nullable().optional(),
  descriptionAr: z.string().max(2000).nullable().optional(),
  flavourAr: z.string().max(280).nullable().optional(),
});

// A quest always starts with English content — a leader authors in whichever
// order suits them, but the DB won't let it publish without Arabic too
// (rule 12, enforced by enforce_quest_publish_requires_both_locales).
export async function createQuestAction(
  input: z.infer<typeof createSchema>,
): Promise<QuestActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid quest details." };

  const leader = await getLeaderIdentity();
  if (!leader) return { ok: false, error: "Not signed in as a leader." };

  const supabase = await createServerSupabaseClient();
  const { data: quest, error: questError } = await supabase
    .from("quests")
    .insert({
      unit_id: leader.unitId,
      tier: parsed.data.tier,
      kind: parsed.data.kind,
      created_by: leader.personId,
    })
    .select("id")
    .single();
  if (questError || !quest) {
    return { ok: false, error: friendlyDbError(questError?.message) };
  }

  const translations = [
    {
      quest_id: quest.id,
      locale: "en" as const,
      title: parsed.data.titleEn,
      flavour: parsed.data.flavourEn || null,
      description: parsed.data.descriptionEn,
    },
    ...(parsed.data.titleAr && parsed.data.descriptionAr
      ? [
          {
            quest_id: quest.id,
            locale: "ar" as const,
            title: parsed.data.titleAr,
            flavour: parsed.data.flavourAr || null,
            description: parsed.data.descriptionAr,
          },
        ]
      : []),
  ];
  const { error: translationError } = await supabase
    .from("quest_translations")
    .insert(translations);
  if (translationError) {
    return { ok: false, error: friendlyDbError(translationError.message) };
  }

  return { ok: true, questId: quest.id };
}

const updateSchema = createSchema.extend({ questId: uuidShape });

export async function updateQuestAction(
  input: z.infer<typeof updateSchema>,
): Promise<QuestActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid quest details." };

  const supabase = await createServerSupabaseClient();
  const { error: questError } = await supabase
    .from("quests")
    .update({ tier: parsed.data.tier, kind: parsed.data.kind })
    .eq("id", parsed.data.questId);
  if (questError) return { ok: false, error: friendlyDbError(questError.message) };

  const { error: enError } = await supabase.from("quest_translations").upsert({
    quest_id: parsed.data.questId,
    locale: "en",
    title: parsed.data.titleEn,
    flavour: parsed.data.flavourEn || null,
    description: parsed.data.descriptionEn,
  });
  if (enError) return { ok: false, error: friendlyDbError(enError.message) };

  if (parsed.data.titleAr && parsed.data.descriptionAr) {
    const { error: arError } = await supabase.from("quest_translations").upsert({
      quest_id: parsed.data.questId,
      locale: "ar",
      title: parsed.data.titleAr,
      flavour: parsed.data.flavourAr || null,
      description: parsed.data.descriptionAr,
    });
    if (arError) return { ok: false, error: friendlyDbError(arError.message) };
  }

  return { ok: true, questId: parsed.data.questId };
}

const publishSchema = z.object({ questId: uuidShape, publish: z.boolean() });

export async function setQuestPublishedAction(
  input: z.infer<typeof publishSchema>,
): Promise<QuestActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("quests")
    .update({ published_at: parsed.data.publish ? new Date().toISOString() : null })
    .eq("id", parsed.data.questId);
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  return { ok: true, questId: parsed.data.questId };
}

const translateSchema = z.object({
  sourceLocale: z.enum(["en", "ar"]),
  targetLocale: z.enum(["en", "ar"]),
  title: z.string().min(1).max(120),
  flavour: z.string().max(280).nullable().optional(),
  description: z.string().min(1).max(2000),
});

export interface TranslateQuestResult {
  ok: boolean;
  title?: string;
  flavour?: string | null;
  description?: string;
  error?: string;
}

// Produces an editable draft only — never writes to quest_translations
// itself. The leader's own Save/Create click is what persists it (and can
// persist an edited version, not the machine draft — docs/tasks/11-bilingual.md).
export async function translateQuestAction(
  input: z.infer<typeof translateSchema>,
): Promise<TranslateQuestResult> {
  const parsed = translateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const leader = await getLeaderIdentity();
  if (!leader) return { ok: false, error: "Not signed in as a leader." };

  const supabase = await createServerSupabaseClient();
  const { data: allowed } = await supabase.rpc("try_consume_translate_quota");
  if (!allowed) {
    return { ok: false, error: "Too many translation requests — try again in a bit." };
  }

  const result = await getTranslator().translateQuest({
    sourceLocale: parsed.data.sourceLocale,
    targetLocale: parsed.data.targetLocale,
    title: parsed.data.title,
    flavour: parsed.data.flavour ?? null,
    description: parsed.data.description,
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not translate that. Try again." };
  }
  return {
    ok: true,
    title: result.title,
    flavour: result.flavour,
    description: result.description,
  };
}

const prereqsSchema = z.object({
  questId: uuidShape,
  requiresQuestIds: z.array(uuidShape),
});

// Replace-the-set rather than diff-and-patch: a leader's picker always
// submits the full desired list, and the set is small (a handful of
// prerequisites per quest) so delete-then-insert costs nothing meaningful.
// The no-cycle trigger fires per inserted row, so any offending edge in the
// new set surfaces as this call's own error.
export async function setQuestPrereqsAction(
  input: z.infer<typeof prereqsSchema>,
): Promise<QuestActionResult> {
  const parsed = prereqsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createServerSupabaseClient();
  const { error: deleteError } = await supabase
    .from("quest_prereqs")
    .delete()
    .eq("quest_id", parsed.data.questId);
  if (deleteError) return { ok: false, error: friendlyDbError(deleteError.message) };

  if (parsed.data.requiresQuestIds.length > 0) {
    const { error: insertError } = await supabase.from("quest_prereqs").insert(
      parsed.data.requiresQuestIds.map((requiresQuestId) => ({
        quest_id: parsed.data.questId,
        requires_quest_id: requiresQuestId,
      })),
    );
    if (insertError) return { ok: false, error: friendlyDbError(insertError.message) };
  }

  return { ok: true, questId: parsed.data.questId };
}
