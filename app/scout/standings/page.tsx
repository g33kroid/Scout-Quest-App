import Link from "next/link";

// Placeholder — leaderboards are a later task. Exists so the home screen's
// "one tap away" link (CLAUDE.md: "Leaderboards one tap away, never the
// landing view") has somewhere real to land, same reasoning as the old
// app/scout/page.tsx placeholder it replaces.
export default function ScoutStandingsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-6 py-8">
      <p>Standings are coming soon.</p>
      <Link href="/scout" className="text-sm text-blue-600">
        Back home
      </Link>
    </main>
  );
}
