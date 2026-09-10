"use client";

import { useActionState } from "react";
import { confirmEnrollmentAction, type ConfirmEnrollmentFormState } from "./actions";

const initialState: ConfirmEnrollmentFormState = {};

export function ConfirmEnrollmentForm({ factorId }: { factorId: string }) {
  const boundAction = confirmEnrollmentAction.bind(null, factorId);
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
        {pending ? "Confirming…" : "Confirm"}
      </button>
    </form>
  );
}
