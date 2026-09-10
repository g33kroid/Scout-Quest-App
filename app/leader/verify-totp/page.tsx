import { redirect } from "next/navigation";
import { getLeaderSessionState } from "@/lib/server/leader-auth";
import { VerifyTotpForm } from "./verify-form";

export default async function VerifyTotpPage() {
  const state = await getLeaderSessionState();

  if (state.status === "unauthenticated") {
    redirect("/leader/login");
  }
  if (state.status === "needs_enrollment") {
    redirect("/leader/enroll-totp");
  }
  if (state.status === "ready") {
    redirect("/leader");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Enter your authenticator code</h1>
      <VerifyTotpForm factorId={state.factorId} />
    </main>
  );
}
