"use client";

import { useActionState } from "react";
import { scoutLoginAction, type ScoutLoginFormState } from "./actions";

const initialState: ScoutLoginFormState = {};

export default function ScoutLoginPage() {
  const [state, formAction, pending] = useActionState(scoutLoginAction, initialState);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Scout sign in</h1>

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Join code</span>
          <input
            name="joinCode"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            required
            className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            name="nickname"
            type="text"
            autoComplete="off"
            required
            className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">6-digit PIN</span>
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="off"
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
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
