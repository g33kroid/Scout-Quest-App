"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setLeaderWhatsAppNumber } from "@/lib/server/leader-auth";

const schema = z.object({
  whatsappNumber: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
});

export interface SetWhatsAppNumberFormState {
  error?: string;
}

export async function setWhatsAppNumberAction(
  _prevState: SetWhatsAppNumberFormState,
  formData: FormData,
): Promise<SetWhatsAppNumberFormState> {
  const parsed = schema.safeParse({ whatsappNumber: formData.get("whatsappNumber") });
  if (!parsed.success) {
    return { error: "Enter a number in international format, e.g. +9715XXXXXXXX." };
  }

  const result = await setLeaderWhatsAppNumber(parsed.data.whatsappNumber);
  if (!result.ok) {
    return { error: result.error };
  }

  // The actual code send happens on /leader/verify-otp's own render — one
  // send trigger, not two.
  redirect("/leader/verify-otp");
}
