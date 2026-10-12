import { redirect } from "next/navigation";
import {
  getAttentionNeededScouts,
  getRosterForSession,
  getTodaysSessionsForLeader,
} from "@/lib/server/leader-roster";
import { ScoringScreen } from "./scoring-screen";

// The 15-second screen (docs/tasks/05-leader-scoring.md). Server-resolves
// context so the common case (exactly one session today) is zero taps: the
// roster IS the home screen, no picker, no navigation.
export default async function LeaderHomePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;
  const sessions = await getTodaysSessionsForLeader();

  if (!sessionId) {
    if (sessions.length === 1) {
      redirect(`/leader?session=${sessions[0].id}`);
    }
    if (sessions.length === 0) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-6 py-8">
          <p>No session scheduled for your unit today.</p>
        </main>
      );
    }
    // Two-or-more concurrent assignments: a one-tap chooser, not a menu.
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-6 py-8">
        <h1 className="text-xl font-semibold">Which session?</h1>
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <a
                href={`/leader?session=${s.id}`}
                className="flex min-h-12 items-center rounded-lg border border-zinc-300 px-4 text-base"
              >
                {new Date(s.scheduledAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const validSession = sessions.find((s) => s.id === sessionId);
  if (!validSession) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-6 py-8">
        <p>That session isn&apos;t available.</p>
      </main>
    );
  }

  const roster = await getRosterForSession(sessionId);
  const attentionNeeded = await getAttentionNeededScouts(roster.map((s) => s.personId));

  return (
    <ScoringScreen
      sessionId={sessionId}
      initialRoster={roster}
      attentionNeeded={attentionNeeded}
    />
  );
}
