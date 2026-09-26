import type { Locale } from "@/lib/i18n/messages";

// D15 (docs/open-decisions.md, resolved 2026-09-26): Western digits (0-9)
// everywhere, both locales — Intl's `ar` locale defaults to Arabic-Indic
// digits, so the `-u-nu-latn` extension has to be pinned explicitly rather
// than trusted to fall out of the locale choice.
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US").format(value);
}
