"use client";

import { useActionState } from "react";
import { verifyTotpAction, type VerifyTotpFormState } from "./actions";

const initialState: VerifyTotpFormState = {};

export function VerifyTotpForm({ factorId }: { factorId: string }) {
  const boundAction = verifyTotpAction.bind(null, factorId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
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
        {pending ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}
