import { getLocale } from "@/lib/server/locale";
import { t } from "@/lib/i18n/messages";
import { QuestForm } from "../quest-form";

export default async function NewQuestPage() {
  const locale = await getLocale();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 pb-8">
      <h1 className="text-xl font-semibold">{t(locale, "leaderQuests.newHeading")}</h1>
      <QuestForm mode="create" locale={locale} />
    </main>
  );
}
