"use server";

import { z } from "zod";
import { setLocale } from "@/lib/server/locale";

const schema = z.enum(["en", "ar"]);

// Thin Server Action wrapper so a client component's locale toggle
// (app/components/locale-toggle.tsx) can call setLocale() directly —
// lib/server/locale.ts itself isn't "use server", it's a plain server-only
// helper other server code (Server Components, other actions) also calls.
export async function setLocaleAction(locale: string): Promise<void> {
  const parsed = schema.safeParse(locale);
  if (!parsed.success) return;
  await setLocale(parsed.data);
}
