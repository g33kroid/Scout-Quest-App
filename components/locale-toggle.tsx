"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/lib/server/locale-action";
import { t, type Locale } from "@/lib/i18n/messages";

// Language names shown as autonyms ("English", "العربية") regardless of the
// current UI locale — same convention every language picker uses, since
// these name the language itself rather than translate a UI label.
export function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1 text-sm" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => switchTo("en")}
        aria-pressed={locale === "en"}
        disabled={isPending}
        className={`min-h-8 rounded px-2 ${locale === "en" ? "font-semibold underline" : "text-zinc-500"}`}
      >
        {t(locale, "common.switchToEnglish")}
      </button>
      <button
        type="button"
        onClick={() => switchTo("ar")}
        aria-pressed={locale === "ar"}
        disabled={isPending}
        className={`min-h-8 rounded px-2 ${locale === "ar" ? "font-semibold underline" : "text-zinc-500"}`}
      >
        {t(locale, "common.switchToArabic")}
      </button>
    </div>
  );
}
