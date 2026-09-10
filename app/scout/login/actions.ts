"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginScout } from "@/lib/server/scout-auth";

const schema = z.object({
  joinCode: z.string().min(1).max(32),
  nickname: z.string().min(1).max(60),
  pin: z.string().regex(/^\d{6}$/, "PIN must be 6 digits"),
});

export interface ScoutLoginFormState {
  error?: string;
}

export async function scoutLoginAction(
  _prevState: ScoutLoginFormState,
  formData: FormData,
): Promise<ScoutLoginFormState> {
  const parsed = schema.safeParse({
    joinCode: formData.get("joinCode"),
    nickname: formData.get("nickname"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) {
    return { error: "Check your join code, name, and PIN." };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

  const result = await loginScout(
    parsed.data.joinCode,
    parsed.data.nickname,
    parsed.data.pin,
    ip,
  );

  if (!result.ok) {
    if (result.reason === "locked") {
      return { error: "Too many attempts. Try again in a bit." };
    }
    // Deliberately the same message for a bad join code, unknown name, or
    // wrong PIN — never reveal which part was wrong.
    return { error: "That join code, name, or PIN doesn't match." };
  }

  redirect("/scout");
}
