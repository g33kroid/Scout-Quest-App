// Placeholder — the real scout home screen (personal progression, journal,
// next unlock) is a later task. This exists so the auth/route-guard chain
// has somewhere real to land.
export default function ScoutHomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-8">
      <p>Signed in.</p>
    </main>
  );
}
