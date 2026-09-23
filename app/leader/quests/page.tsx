import Link from "next/link";
import { getQuestsForLeaderUnit, TIER_POINTS } from "@/lib/server/quest-authoring";

// docs/tasks/09-quests-board.md: leader authoring list. Server Component —
// the list arrives rendered, no client fetch (docs/tasks/00b-cross-cutting-ui.md).
export default async function LeaderQuestsPage() {
  const quests = await getQuestsForLeaderUnit();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quests</h1>
        <Link
          href="/leader/quests/new"
          className="flex min-h-12 items-center rounded-lg bg-blue-600 px-4 text-base font-semibold text-white"
        >
          New quest
        </Link>
      </div>

      {quests.length === 0 ? (
        <p className="text-sm text-zinc-500">No quests yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quests.map((q) => {
            const en = q.translations.find((t) => t.locale === "en");
            return (
              <li key={q.id}>
                <Link
                  href={`/leader/quests/${q.id}/edit`}
                  className="flex min-h-12 flex-col justify-center rounded-lg border border-zinc-300 px-4 py-2"
                >
                  <span className="text-base font-medium">
                    {en?.title ?? "(untitled draft)"}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {q.tier} · {TIER_POINTS[q.tier]} pts · {q.kind}
                    {" · "}
                    {q.publishedAt ? "published" : "draft"}
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
