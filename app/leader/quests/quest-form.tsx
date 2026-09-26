"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createQuestAction,
  setQuestPrereqsAction,
  setQuestPublishedAction,
  translateQuestAction,
  updateQuestAction,
} from "./actions";
import {
  KIND_MESSAGE_KEY,
  TIER_MESSAGE_KEY,
  TIER_POINTS,
  type QuestKind,
  type QuestOption,
  type QuestTier,
} from "@/lib/quest-shared";
import { t, type Locale } from "@/lib/i18n/messages";
import { formatNumber } from "@/lib/i18n/format";

interface QuestFormProps {
  mode: "create" | "edit";
  locale: Locale;
  questId?: string;
  initial?: {
    tier: QuestTier;
    kind: QuestKind;
    titleEn: string;
    descriptionEn: string;
    flavourEn: string | null;
    titleAr: string;
    descriptionAr: string;
    flavourAr: string | null;
    publishedAt: string | null;
  };
  prereqOptions?: QuestOption[];
  initialPrereqIds?: string[];
}

const TIERS: QuestTier[] = ["minor", "standard", "major", "epic"];
const KINDS: QuestKind[] = ["solo", "group"];

interface LocaleFieldsetProps {
  dir?: "rtl";
  legend: string;
  titleLabel: string;
  flavourLabel: string;
  descriptionLabel: string;
  title: string;
  onTitleChange: (value: string) => void;
  flavour: string;
  onFlavourChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  required?: boolean;
  translateAction?: { label: string; onClick: () => void; disabled: boolean };
}

// English and Arabic authoring fields are the same three inputs twice —
// shared here rather than duplicated per locale.
function LocaleFieldset({
  dir,
  legend,
  titleLabel,
  flavourLabel,
  descriptionLabel,
  title,
  onTitleChange,
  flavour,
  onFlavourChange,
  description,
  onDescriptionChange,
  required,
  translateAction,
}: LocaleFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-3" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium">{legend}</legend>
        {translateAction && (
          <button
            type="button"
            onClick={translateAction.onClick}
            disabled={translateAction.disabled}
            className="text-sm text-blue-600 disabled:opacity-50"
          >
            {translateAction.label}
          </button>
        )}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm">{titleLabel}</span>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          required={required}
          maxLength={120}
          className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">{flavourLabel}</span>
        <input
          value={flavour}
          onChange={(e) => onFlavourChange(e.target.value)}
          maxLength={280}
          className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">{descriptionLabel}</span>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          required={required}
          maxLength={2000}
          rows={3}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base"
        />
      </label>
    </fieldset>
  );
}

export function QuestForm({
  mode,
  locale,
  questId,
  initial,
  prereqOptions = [],
  initialPrereqIds = [],
}: QuestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isTranslating, setIsTranslating] = useState<"en" | "ar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<QuestTier>(initial?.tier ?? "minor");
  const [kind, setKind] = useState<QuestKind>(initial?.kind ?? "solo");
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? "");
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn ?? "");
  const [flavourEn, setFlavourEn] = useState(initial?.flavourEn ?? "");
  const [titleAr, setTitleAr] = useState(initial?.titleAr ?? "");
  const [descriptionAr, setDescriptionAr] = useState(initial?.descriptionAr ?? "");
  const [flavourAr, setFlavourAr] = useState(initial?.flavourAr ?? "");
  const [prereqIds, setPrereqIds] = useState<string[]>(initialPrereqIds);
  const isPublished = Boolean(initial?.publishedAt);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        tier,
        kind,
        titleEn,
        descriptionEn,
        flavourEn: flavourEn || null,
        titleAr: titleAr || null,
        descriptionAr: descriptionAr || null,
        flavourAr: flavourAr || null,
      };
      const result =
        mode === "create"
          ? await createQuestAction(payload)
          : await updateQuestAction({ ...payload, questId: questId! });

      if (!result.ok || !result.questId) {
        setError(result.error ?? t(locale, "leaderQuests.genericSaveError"));
        return;
      }
      if (mode === "create") {
        router.push(`/leader/quests/${result.questId}/edit`);
      } else {
        router.refresh();
      }
    });
  }

  function handlePrereqsSave() {
    if (!questId) return;
    setError(null);
    startTransition(async () => {
      const result = await setQuestPrereqsAction({
        questId,
        requiresQuestIds: prereqIds,
      });
      if (!result.ok) {
        setError(result.error ?? t(locale, "leaderQuests.genericSaveError"));
        return;
      }
      router.refresh();
    });
  }

  function handleTogglePublish() {
    if (!questId) return;
    setError(null);
    startTransition(async () => {
      const result = await setQuestPublishedAction({ questId, publish: !isPublished });
      if (!result.ok) {
        setError(result.error ?? t(locale, "leaderQuests.genericSaveError"));
        return;
      }
      router.refresh();
    });
  }

  function buildTranslateAction(target: "en" | "ar") {
    const sourceFilled =
      target === "ar"
        ? Boolean(titleEn && descriptionEn)
        : Boolean(titleAr && descriptionAr);
    return {
      label:
        isTranslating === target
          ? t(locale, "leaderQuests.translating")
          : t(
              locale,
              target === "ar"
                ? "leaderQuests.translateToArabic"
                : "leaderQuests.translateToEnglish",
            ),
      onClick: () => handleTranslate(target),
      disabled: isTranslating !== null || !sourceFilled,
    };
  }

  // Fills the *other* language as an editable draft — never saved until the
  // leader's own Create/Save click (docs/tasks/11-bilingual.md).
  async function handleTranslate(target: "en" | "ar") {
    setError(null);
    setIsTranslating(target);
    const result = await translateQuestAction(
      target === "ar"
        ? {
            sourceLocale: "en",
            targetLocale: "ar",
            title: titleEn,
            flavour: flavourEn || null,
            description: descriptionEn,
          }
        : {
            sourceLocale: "ar",
            targetLocale: "en",
            title: titleAr,
            flavour: flavourAr || null,
            description: descriptionAr,
          },
    );
    setIsTranslating(null);

    if (!result.ok) {
      setError(result.error ?? t(locale, "leaderQuests.translateError"));
      return;
    }
    if (target === "ar") {
      setTitleAr(result.title ?? "");
      setFlavourAr(result.flavour ?? "");
      setDescriptionAr(result.description ?? "");
    } else {
      setTitleEn(result.title ?? "");
      setFlavourEn(result.flavour ?? "");
      setDescriptionEn(result.description ?? "");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">
            {t(locale, "leaderQuests.tier")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map((tierOption) => (
              <button
                key={tierOption}
                type="button"
                onClick={() => setTier(tierOption)}
                aria-pressed={tier === tierOption}
                className={`min-h-12 rounded-lg border px-4 text-start text-base capitalize ${
                  tier === tierOption
                    ? "border-blue-600 bg-blue-50 font-semibold"
                    : "border-zinc-300"
                }`}
              >
                {t(locale, "leaderQuests.tierOption", {
                  tier: t(locale, TIER_MESSAGE_KEY[tierOption]),
                  points: formatNumber(TIER_POINTS[tierOption], locale),
                })}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">
            {t(locale, "leaderQuests.kind")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((kindOption) => (
              <button
                key={kindOption}
                type="button"
                onClick={() => setKind(kindOption)}
                aria-pressed={kind === kindOption}
                className={`min-h-12 rounded-lg border px-4 text-start text-base capitalize ${
                  kind === kindOption
                    ? "border-blue-600 bg-blue-50 font-semibold"
                    : "border-zinc-300"
                }`}
              >
                {t(locale, KIND_MESSAGE_KEY[kindOption])}
              </button>
            ))}
          </div>
        </fieldset>

        {/*
          These field labels name which language's content you're typing —
          "Title"/"العنوان" always stay in that block's own language,
          independent of the leader's own UI locale (t(locale, ...) would
          make both blocks say "Title" whenever the UI is in English —
          confirmed the hard way, an E2E strict-mode collision).
        */}
        <LocaleFieldset
          legend="English"
          titleLabel="Title"
          flavourLabel="Flavour (optional)"
          descriptionLabel="Description"
          title={titleEn}
          onTitleChange={setTitleEn}
          flavour={flavourEn}
          onFlavourChange={setFlavourEn}
          description={descriptionEn}
          onDescriptionChange={setDescriptionEn}
          required
          translateAction={buildTranslateAction("en")}
        />

        <LocaleFieldset
          dir="rtl"
          legend="العربية"
          titleLabel="العنوان"
          flavourLabel="وصف قصير (اختياري)"
          descriptionLabel="الوصف"
          title={titleAr}
          onTitleChange={setTitleAr}
          flavour={flavourAr}
          onFlavourChange={setFlavourAr}
          description={descriptionAr}
          onDescriptionChange={setDescriptionAr}
          translateAction={buildTranslateAction("ar")}
        />
        <p className="text-sm text-zinc-500">{t(locale, "leaderQuests.translateHint")}</p>

        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-lg bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {mode === "create"
            ? t(locale, "leaderQuests.createQuest")
            : t(locale, "leaderQuests.saveChanges")}
        </button>
      </form>

      {mode === "edit" && questId && (
        <>
          <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6">
            <h2 className="text-sm font-medium">
              {t(locale, "leaderQuests.prerequisites")}
            </h2>
            {prereqOptions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {t(locale, "leaderQuests.noOtherQuests")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {prereqOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-300 px-4 text-base"
                  >
                    <input
                      type="checkbox"
                      checked={prereqIds.includes(opt.id)}
                      onChange={(e) =>
                        setPrereqIds((prev) =>
                          e.target.checked
                            ? [...prev, opt.id]
                            : prev.filter((id) => id !== opt.id),
                        )
                      }
                      className="h-5 w-5"
                    />
                    {opt.title}
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handlePrereqsSave}
              disabled={isPending}
              className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base disabled:opacity-50"
            >
              {t(locale, "leaderQuests.savePrereqs")}
            </button>
          </section>

          <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6">
            <h2 className="text-sm font-medium">
              {t(locale, "leaderQuests.publishing")}
            </h2>
            <p className="text-sm text-zinc-500">
              {isPublished
                ? t(locale, "leaderQuests.publishedHint")
                : t(locale, "leaderQuests.draftHint")}
            </p>
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={isPending}
              className="min-h-12 rounded-lg bg-zinc-900 px-4 text-base font-semibold text-white disabled:opacity-50"
            >
              {isPublished
                ? t(locale, "leaderQuests.unpublish")
                : t(locale, "leaderQuests.publish")}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
