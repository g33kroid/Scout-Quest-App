"use client";

import { useActionState, useState, useTransition } from "react";
import { resendOtpAction, verifyOtpAction, type VerifyOtpFormState } from "./actions";

const initialState: VerifyOtpFormState = {};

export function VerifyOtpForm({ personId }: { personId: string }) {
  const boundAction = verifyOtpAction.bind(null, personId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [resendState, setResendState] = useState<VerifyOtpFormState>({});
  const [resendPending, startResend] = useTransition();

  function handleResend() {
    startResend(async () => {
      const result = await resendOtpAction(personId);
      setResendState(result.error ? result : { error: undefined });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">6-digit code</span>
          <input
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base tracking-widest"
          />
        </label>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-60"
        >
          {pending ? "Confirming…" : "Confirm"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resendPending}
        className="min-h-12 rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-900 disabled:opacity-60"
      >
        {resendPending ? "Resending…" : "Resend code"}
      </button>
      {resendState.error ? (
        <p role="alert" className="text-sm text-red-600">
          {resendState.error}
        </p>
      ) : null}
    </div>
  );
}
