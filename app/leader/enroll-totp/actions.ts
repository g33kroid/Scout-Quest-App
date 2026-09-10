"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyLeaderTotp } from "@/lib/server/leader-auth";

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });

export interface ConfirmEnrollmentFormState {
  error?: string;
}

export async function confirmEnrollmentAction(
  factorId: string,
  _prevState: ConfirmEnrollmentFormState,
  formData: FormData,
): Promise<ConfirmEnrollmentFormState> {
  const parsed = schema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: "Enter the 6-digit code." };
  }

  const result = await verifyLeaderTotp(factorId, parsed.data.code);
  if (!result.ok) {
    return { error: "That code didn't work. Try again." };
  }

  redirect("/leader");
}
