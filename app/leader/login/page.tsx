"use client";

import { useActionState } from "react";
import { leaderLoginAction, type LeaderLoginFormState } from "./actions";

const initialState: LeaderLoginFormState = {};

export default function LeaderLoginPage() {
  const [state, formAction, pending] = useActionState(leaderLoginAction, initialState);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Leader sign in</h1>

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-12 rounded-lg border border-zinc-300 px-4 text-base"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
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
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
