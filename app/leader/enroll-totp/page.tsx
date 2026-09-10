import { enrollLeaderTotp } from "@/lib/server/leader-auth";
import { ConfirmEnrollmentForm } from "./confirm-form";

export default async function EnrollTotpPage() {
  const { data, error } = await enrollLeaderTotp();

  if (error || !data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-6 py-8">
        <p>Could not start authenticator setup. Try signing in again.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Set up your authenticator app</h1>
      <p className="text-sm text-zinc-600">
        Scan this with an authenticator app (e.g. Google Authenticator, 1Password), then
        enter the 6-digit code it shows.
      </p>
      {/* Supabase returns the QR code as an inline SVG data URI — next/image
          doesn't handle data URIs cleanly, so a plain img is the right tool here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.totp.qr_code}
        alt="Authenticator app enrollment QR code"
        width={200}
        height={200}
        className="self-center"
      />
      <p className="self-center font-mono text-xs break-all text-zinc-500">
        {data.totp.secret}
      </p>
      <ConfirmEnrollmentForm factorId={data.id} />
    </main>
  );
}
