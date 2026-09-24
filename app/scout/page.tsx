import Link from "next/link";
import { getHomeScreenData } from "@/lib/server/scout-journal";

// docs/tasks/10-journal.md: personal progression home screen. "Rankings are
// one tap away, never the landing view" — this queries no
// leaderboard/rank, only the scout's own streak, activity, and patrol
// contribution, plus a link out to standings.
export default async function ScoutHomePage() {
  const data = await getHomeScreenData();

  if (!data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-8">
        <p>Not signed in.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-8 px-6 py-8">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border border-zinc-300 px-4 py-3">
          <span className="text-sm text-zinc-500">Streak</span>
          <span className="text-2xl font-semibold">{data.streak}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-zinc-300 px-4 py-3">
          <span className="text-sm text-zinc-500">Points</span>
          <span className="text-2xl font-semibold">{data.totalPoints}</span>
        </div>
      </div>

      {data.patrolTotal !== null && (
        <div className="flex flex-col gap-1 rounded-lg border border-zinc-300 px-4 py-3">
          <span className="text-sm text-zinc-500">Your patrol&apos;s total</span>
          <span className="text-2xl font-semibold">{data.patrolTotal}</span>
          <span className="text-sm text-zinc-500">
            You&apos;ve contributed {data.totalPoints} of it
          </span>
        </div>
      )}

      {data.nextUnlock && (
        <div className="flex flex-col gap-1 rounded-lg border border-zinc-300 px-4 py-3">
          <span className="text-sm text-zinc-500">Next unlock</span>
          <span className="text-base font-medium">{data.nextUnlock.title}</span>
          <span className="text-sm text-zinc-500">
            Requires: {data.nextUnlock.unmetPrereqTitles.join(", ")}
          </span>
        </div>
      )}

      <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
        <h2 id="recent-heading" className="text-sm font-medium text-zinc-500">
          Recent activity
        </h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing completed yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recentActivity.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-zinc-300 px-4 py-3"
              >
                <span className="text-base">{a.title}</span>
                <span className="text-sm text-zinc-500">{a.pointsEarned} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="mt-auto flex flex-col gap-3">
        <Link
          href="/scout/journal"
          className="flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-4 text-base font-semibold text-white"
        >
          Journal
        </Link>
        <Link
          href="/scout/standings"
          className="flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base"
        >
          Standings
        </Link>
      </nav>
    </main>
  );
}
