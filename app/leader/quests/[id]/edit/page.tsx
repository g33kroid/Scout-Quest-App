import { notFound } from "next/navigation";
import { getPrereqOptions, getQuestsForLeaderUnit } from "@/lib/server/quest-authoring";
import { getLocale } from "@/lib/server/locale";
import { t } from "@/lib/i18n/messages";
import { QuestForm } from "../../quest-form";

export default async function EditQuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quests, locale] = await Promise.all([getQuestsForLeaderUnit(), getLocale()]);
  const quest = quests.find((q) => q.id === id);
  if (!quest) notFound();

  const enTranslation = quest.translations.find((tr) => tr.locale === "en");
  const arTranslation = quest.translations.find((tr) => tr.locale === "ar");
  const prereqOptions = await getPrereqOptions(id);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 pb-8">
      <h1 className="text-xl font-semibold">{t(locale, "leaderQuests.editHeading")}</h1>
      <QuestForm
        mode="edit"
        locale={locale}
        questId={quest.id}
        initial={{
          tier: quest.tier,
          kind: quest.kind,
          titleEn: enTranslation?.title ?? "",
          descriptionEn: enTranslation?.description ?? "",
          flavourEn: enTranslation?.flavour ?? null,
          titleAr: arTranslation?.title ?? "",
          descriptionAr: arTranslation?.description ?? "",
          flavourAr: arTranslation?.flavour ?? null,
          publishedAt: quest.publishedAt,
        }}
        prereqOptions={prereqOptions}
        initialPrereqIds={quest.prereqIds}
      />
    </main>
  );
}
