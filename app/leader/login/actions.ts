"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getLeaderSessionState, loginLeaderPassword } from "@/lib/server/leader-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface LeaderLoginFormState {
  error?: string;
}

export async function leaderLoginAction(
  _prevState: LeaderLoginFormState,
  formData: FormData,
): Promise<LeaderLoginFormState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

  const result = await loginLeaderPassword(parsed.data.email, parsed.data.password, ip);
  if (!result.ok) {
    if (result.reason === "locked") {
      return { error: "Too many attempts. Try again in a bit." };
    }
    return { error: "Incorrect email or password." };
  }

  // Password verified — route to whatever TOTP step (or none) comes next.
  const state = await getLeaderSessionState();
  if (state.status === "needs_enrollment") {
    redirect("/leader/enroll-totp");
  }
  if (state.status === "needs_mfa_challenge") {
    redirect("/leader/verify-totp");
  }
  redirect("/leader");
}
