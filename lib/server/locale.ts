import "server-only";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/server/supabase-server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/messages";

export const LOCALE_COOKIE = "locale";

// docs/tasks/11-bilingual.md: "locale preference persists across devices
// for the same scout." people.locale (Wave 1 schema) is the source of
// truth for a signed-in person; the cookie is only what a pre-auth screen
// (a login page, nobody signed in yet) has to go on, and what makes a
// locale switch take effect immediately without a round trip to Postgres
// on every single render.
export async function getLocale(): Promise<Locale> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: person } = await supabase
      .from("people")
      .select("locale")
      .eq("id", user.id)
      .maybeSingle();
    if (isLocale(person?.locale)) return person.locale;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return DEFAULT_LOCALE;
}

// Always sets the cookie (so the switch is instant, including pre-auth);
// also persists to people.locale via set_own_locale() when signed in, so
// it's still there next time this scout opens the app on a different
// device. set_own_locale is the only write path onto that column — see
// supabase/migrations/20260926090000_task11_set_own_locale.sql.
export async function setLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.rpc("set_own_locale", { p_locale: locale });
  }
}
