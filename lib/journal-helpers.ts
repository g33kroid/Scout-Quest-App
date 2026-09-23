// Pure helpers factored out of lib/server/scout-journal.ts so they're
// testable without pulling in "server-only" (which throws on import outside
// a Server Component — see lib/server/scout-journal.ts) or a DB round trip.

export interface JournalQuest {
  questId: string;
  title: string;
  flavour: string | null;
  tier: string;
  kind: "solo" | "group";
  unmetPrereqTitles: string[];
  completedAt: string | null;
  pointsEarned: number | null;
  teammateCount: number | null;
}

// The locked quest needing the fewest remaining prerequisites, so the
// "next unlock" hint on the home screen points at whatever's closest to
// available.
export function pickNextUnlock(locked: JournalQuest[]): JournalQuest | null {
  if (locked.length === 0) return null;
  return [...locked].sort(
    (a, b) => a.unmetPrereqTitles.length - b.unmetPrereqTitles.length,
  )[0];
}
