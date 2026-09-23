"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getRequestIp,
  sendLeaderOtpChallenge,
  verifyLeaderOtp,
} from "@/lib/server/leader-auth";

const uuidShape = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const codeSchema = z.object({ personId: uuidShape, code: z.string().regex(/^\d{6}$/) });

export interface VerifyOtpFormState {
  error?: string;
}

export async function verifyOtpAction(
  personId: string,
  _prevState: VerifyOtpFormState,
  formData: FormData,
): Promise<VerifyOtpFormState> {
  const parsed = codeSchema.safeParse({ personId, code: formData.get("code") });
  if (!parsed.success) {
    return { error: "Enter the 6-digit code." };
  }

  const ip = await getRequestIp();
  const result = await verifyLeaderOtp(parsed.data.personId, parsed.data.code, ip);

  if (!result.ok) {
    if (result.reason === "locked") {
      return { error: "Too many attempts. Try again in a bit." };
    }
    if (result.reason === "no_active_challenge") {
      return { error: "That code expired. Tap resend for a new one." };
    }
    return { error: "That code didn't work. Try again." };
  }

  redirect("/leader");
}

export async function resendOtpAction(personId: string): Promise<VerifyOtpFormState> {
  const parsed = uuidShape.safeParse(personId);
  if (!parsed.success) {
    return { error: "Something went wrong. Sign in again." };
  }

  const result = await sendLeaderOtpChallenge(personId);
  if (!result.ok) {
    return { error: result.error };
  }
  return {};
}
