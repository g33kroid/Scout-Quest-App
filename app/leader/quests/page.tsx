import Link from "next/link";
import { getQuestsForLeaderUnit } from "@/lib/server/quest-authoring";
import { getLocale } from "@/lib/server/locale";
import { t } from "@/lib/i18n/messages";
import { formatNumber } from "@/lib/i18n/format";
import { TIER_MESSAGE_KEY, TIER_POINTS, KIND_MESSAGE_KEY } from "@/lib/quest-shared";

// docs/tasks/09-quests-board.md: leader authoring list. Server Component —
// the list arrives rendered, no client fetch (docs/tasks/00b-cross-cutting-ui.md).
export default async function LeaderQuestsPage() {
  const [quests, locale] = await Promise.all([getQuestsForLeaderUnit(), getLocale()]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 px-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t(locale, "leaderQuests.title")}</h1>
        <Link
          href="/leader/quests/new"
          className="flex min-h-12 items-center rounded-lg bg-blue-600 px-4 text-base font-semibold text-white"
        >
          {t(locale, "leaderQuests.newQuest")}
        </Link>
      </div>

      {quests.length === 0 ? (
        <p className="text-sm text-zinc-500">{t(locale, "leaderQuests.noQuests")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quests.map((quest) => {
            const enTranslation = quest.translations.find((tr) => tr.locale === "en");
            return (
              <li key={quest.id}>
                <Link
                  href={`/leader/quests/${quest.id}/edit`}
                  className="flex min-h-12 flex-col justify-center rounded-lg border border-zinc-300 px-4 py-2"
                >
                  <span className="text-base font-medium">
                    {enTranslation?.title ?? t(locale, "leaderQuests.untitledDraft")}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {t(locale, "leaderQuests.questSummary", {
                      tier: t(locale, TIER_MESSAGE_KEY[quest.tier]),
                      points: formatNumber(TIER_POINTS[quest.tier], locale),
                      kind: t(locale, KIND_MESSAGE_KEY[quest.kind]),
                      status: t(
                        locale,
                        quest.publishedAt
                          ? "leaderQuests.statusPublished"
                          : "leaderQuests.statusDraft",
                      ),
                    })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
