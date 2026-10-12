import Link from "next/link";
import { getOwnAvatar } from "@/lib/server/avatar";
import { getLocale } from "@/lib/server/locale";
import { t } from "@/lib/i18n/messages";
import { LocaleToggle } from "@/components/locale-toggle";
import { AvatarEditorLoader } from "./avatar-editor-loader";

// docs/tasks/12-avatar.md: a scout builds and edits their own avatar. The
// current config (saved, or the deterministic default from their id) seeds
// the customiser. dir is set from the locale so the customiser lays out RTL
// in Arabic ([dir="rtl"] in globals.css + the app's logical-property rule).
export default async function ScoutAvatarPage() {
  const [avatar, locale] = await Promise.all([getOwnAvatar(), getLocale()]);

  if (!avatar) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-8">
        <p>Not signed in.</p>
      </main>
    );
  }

  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8"
    >
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t(locale, "avatar.title")}</h1>
        <div className="flex items-center gap-3">
          <LocaleToggle locale={locale} />
          <Link href="/scout" className="text-sm text-blue-600">
            {t(locale, "avatar.cancel")}
          </Link>
        </div>
      </div>

      <AvatarEditorLoader seed={avatar.seed} config={avatar.config} locale={locale} />
    </main>
  );
}
