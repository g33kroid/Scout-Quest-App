"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createQuestAction,
  setQuestPrereqsAction,
  setQuestPublishedAction,
  updateQuestAction,
} from "./actions";
import {
  TIER_POINTS,
  type QuestKind,
  type QuestOption,
  type QuestTier,
} from "@/lib/server/quest-authoring";

interface QuestFormProps {
  mode: "create" | "edit";
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
}: LocaleFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-3" dir={dir}>
      <legend className="text-sm font-medium">{legend}</legend>
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
  questId,
  initial,
  prereqOptions = [],
  initialPrereqIds = [],
}: QuestFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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
        setError(result.error ?? "Could not save that. Try again.");
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
        setError(result.error ?? "Could not save prerequisites.");
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
        setError(result.error ?? "Could not update publish state.");
        return;
      }
      router.refresh();
    });
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
          <legend className="text-sm font-medium">Tier</legend>
          <div className="grid grid-cols-2 gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                aria-pressed={tier === t}
                className={`min-h-12 rounded-lg border px-4 text-start text-base capitalize ${
                  tier === t
                    ? "border-blue-600 bg-blue-50 font-semibold"
                    : "border-zinc-300"
                }`}
              >
                {t} · {TIER_POINTS[t]} pts
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Kind</legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`min-h-12 rounded-lg border px-4 text-start text-base capitalize ${
                  kind === k
                    ? "border-blue-600 bg-blue-50 font-semibold"
                    : "border-zinc-300"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </fieldset>

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
        />

        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-lg bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {mode === "create" ? "Create quest" : "Save changes"}
        </button>
      </form>

      {mode === "edit" && questId && (
        <>
          <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6">
            <h2 className="text-sm font-medium">Prerequisites</h2>
            {prereqOptions.length === 0 ? (
              <p className="text-sm text-zinc-500">No other quests in this unit yet.</p>
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
              Save prerequisites
            </button>
          </section>

          <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6">
            <h2 className="text-sm font-medium">Publishing</h2>
            <p className="text-sm text-zinc-500">
              {isPublished
                ? "Published — visible to scouts in this unit."
                : "Draft — not yet visible to scouts. Requires both English and Arabic content."}
            </p>
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={isPending}
              className="min-h-12 rounded-lg bg-zinc-900 px-4 text-base font-semibold text-white disabled:opacity-50"
            >
              {isPublished ? "Unpublish" : "Publish"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
