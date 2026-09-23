import { redirect } from "next/navigation";
import { getLeaderSessionState } from "@/lib/server/leader-auth";
import { SetWhatsAppNumberForm } from "./setup-form";

export default async function SetupWhatsAppPage() {
  const state = await getLeaderSessionState();

  if (state.status === "unauthenticated") {
    redirect("/leader/login");
  }
  if (state.status === "needs_otp_challenge") {
    redirect("/leader/verify-otp");
  }
  if (state.status === "ready") {
    redirect("/leader");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Verify with WhatsApp</h1>
      <p className="text-sm text-zinc-600">
        Enter your WhatsApp number. We&apos;ll send a 6-digit code there every time you
        sign in.
      </p>
      <SetWhatsAppNumberForm />
    </main>
  );
}
