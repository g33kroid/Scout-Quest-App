import { notFound } from "next/navigation";
import { getPrereqOptions, getQuestsForLeaderUnit } from "@/lib/server/quest-authoring";
import { QuestForm } from "../../quest-form";

export default async function EditQuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quests = await getQuestsForLeaderUnit();
  const quest = quests.find((q) => q.id === id);
  if (!quest) notFound();

  const en = quest.translations.find((t) => t.locale === "en");
  const ar = quest.translations.find((t) => t.locale === "ar");
  const prereqOptions = await getPrereqOptions(id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <h1 className="text-xl font-semibold">Edit quest</h1>
      <QuestForm
        mode="edit"
        questId={quest.id}
        initial={{
          tier: quest.tier,
          kind: quest.kind,
          titleEn: en?.title ?? "",
          descriptionEn: en?.description ?? "",
          flavourEn: en?.flavour ?? null,
          titleAr: ar?.title ?? "",
          descriptionAr: ar?.description ?? "",
          flavourAr: ar?.flavour ?? null,
          publishedAt: quest.publishedAt,
        }}
        prereqOptions={prereqOptions}
        initialPrereqIds={quest.prereqIds}
      />
    </main>
  );
}
