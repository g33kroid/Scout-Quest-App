import { redirect } from "next/navigation";
import { getLeaderSessionState, sendLeaderOtpChallenge } from "@/lib/server/leader-auth";
import { VerifyOtpForm } from "./verify-form";

export default async function VerifyOtpPage() {
  const state = await getLeaderSessionState();

  if (state.status === "unauthenticated") {
    redirect("/leader/login");
  }
  if (state.status === "needs_whatsapp_setup") {
    redirect("/leader/setup-whatsapp");
  }
  if (state.status === "ready") {
    redirect("/leader");
  }

  // One send per page load — a resend is an explicit action in the form,
  // not another render of this component.
  const sendResult = await sendLeaderOtpChallenge(state.personId);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Enter your WhatsApp code</h1>
      <p className="text-sm text-zinc-600">
        {sendResult.ok
          ? "We sent a 6-digit code to your WhatsApp. It expires in 5 minutes."
          : "Could not send a code just now — tap resend to try again."}
      </p>
      <VerifyOtpForm personId={state.personId} />
    </main>
  );
}
