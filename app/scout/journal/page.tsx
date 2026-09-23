import Link from "next/link";
import { getJournalSections, type JournalQuest } from "@/lib/server/scout-journal";
import { TIER_POINTS, type QuestTier } from "@/lib/server/quest-authoring";

function QuestCard({
  quest,
  children,
}: {
  quest: JournalQuest;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-zinc-300 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-medium">{quest.title}</span>
        <span className="shrink-0 text-sm text-zinc-500">
          {quest.tier} · {TIER_POINTS[quest.tier as QuestTier]} pts
        </span>
      </div>
      {quest.flavour && <p className="text-sm text-zinc-600">{quest.flavour}</p>}
      {children}
    </li>
  );
}

// docs/tasks/10-journal.md's five sections, built on top of
// docs/tasks/09-quests-board.md's four board states — Active/Locked/
// Completed/Missed render the same underlying quest_board_state either
// task file would have shown separately; one screen avoids two near-
// duplicate views of the same data. Achievements is a Wave 1 placeholder
// (docs/tasks/10-journal.md — badges land Wave 2).
export default async function ScoutJournalPage() {
  const sections = await getJournalSections();

  if (!sections) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-8">
        <p>Not signed in.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Journal</h1>
        <Link href="/scout" className="text-sm text-blue-600">
          Home
        </Link>
      </div>

      <section aria-labelledby="active-heading" className="flex flex-col gap-3">
        <h2 id="active-heading" className="text-sm font-medium text-zinc-500">
          Active
        </h2>
        {sections.active.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing available right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sections.active.map((q) => (
              <QuestCard key={q.questId} quest={q} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="locked-heading" className="flex flex-col gap-3">
        <h2 id="locked-heading" className="text-sm font-medium text-zinc-500">
          Locked
        </h2>
        {sections.locked.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing locked right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sections.locked.map((q) => (
              <QuestCard key={q.questId} quest={q}>
                <p className="text-sm text-zinc-500">
                  Requires: {q.unmetPrereqTitles.join(", ")}
                </p>
              </QuestCard>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="completed-heading" className="flex flex-col gap-3">
        <h2 id="completed-heading" className="text-sm font-medium text-zinc-500">
          Completed
        </h2>
        {sections.completed.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing completed yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sections.completed.map((q) => (
              <QuestCard key={q.questId} quest={q}>
                <p className="text-sm text-zinc-500">
                  {q.completedAt &&
                    new Date(q.completedAt).toLocaleDateString([], {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  {" · "}
                  {q.pointsEarned} pts
                  {q.teammateCount !== null &&
                    q.teammateCount > 0 &&
                    ` · with ${q.teammateCount} teammate${q.teammateCount === 1 ? "" : "s"}`}
                </p>
              </QuestCard>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="missed-heading" className="flex flex-col gap-3">
        <h2 id="missed-heading" className="text-sm font-medium text-zinc-500">
          Missed
        </h2>
        {sections.missed.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing missed — a clean run so far.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sections.missed.map((q) => (
              <QuestCard key={q.questId} quest={q}>
                <p className="text-sm text-zinc-500">A path not taken this time.</p>
              </QuestCard>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="achievements-heading" className="flex flex-col gap-3">
        <h2 id="achievements-heading" className="text-sm font-medium text-zinc-500">
          Achievements
        </h2>
        <p className="text-sm text-zinc-500">Coming soon.</p>
      </section>
    </main>
  );
}
