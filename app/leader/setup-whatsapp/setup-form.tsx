"use client";

import { useActionState } from "react";
import { setWhatsAppNumberAction, type SetWhatsAppNumberFormState } from "./actions";

const initialState: SetWhatsAppNumberFormState = {};

export function SetWhatsAppNumberForm() {
  const [state, formAction, pending] = useActionState(
    setWhatsAppNumberAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">WhatsApp number</span>
        <input
          name="whatsappNumber"
          type="tel"
          inputMode="tel"
          placeholder="+9715XXXXXXXX"
          autoComplete="tel"
          required
          className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base"
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
        {pending ? "Saving…" : "Send code"}
      </button>
    </form>
  );
}
