import { getLocale } from "@/lib/server/locale";
import { LocaleToggle } from "@/components/locale-toggle";

// One representative flow for Task 11's i18n infra (docs/tasks/11-bilingual.md)
// — dir/lang scoped to this subtree rather than the root layout, since the
// rest of the app hasn't moved its strings into message files yet. Promote
// this to app/layout.tsx once the whole app has (see PR notes).
export default async function LeaderQuestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
      className="flex min-h-dvh flex-col"
    >
      <div className="mx-auto flex w-full max-w-sm justify-end px-6 pt-4">
        <LocaleToggle locale={locale} />
      </div>
      {children}
    </div>
  );
}
