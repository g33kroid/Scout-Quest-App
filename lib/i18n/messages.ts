// Message-file i18n (docs/tasks/11-bilingual.md: "UI chrome: i18n message
// files, translated once at build time. Not generated at runtime.") — no
// "server-only" here deliberately, so client components can import and
// look up messages directly without pulling a server module into their
// bundle (see lib/quest-shared.ts for why that matters).
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export type Locale = "en" | "ar";
export const LOCALES: readonly Locale[] = ["en", "ar"];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ar";
}

const MESSAGES: Record<Locale, typeof en> = { en, ar };

// Dotted-path lookup ("leaderQuests.title") with simple {var} interpolation.
// No pluralization/ICU — the string surface here is small and doesn't need it.
export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const messages = MESSAGES[locale];
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      messages,
    );

  if (typeof value !== "string") {
    return key;
  }
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
