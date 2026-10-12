"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AvatarCustomizeInline, REACT_NICE_AVATAR_SECTIONS } from "react-avatar-studio";
import { setAvatarConfigAction } from "@/lib/server/avatar-action";
import { randomAvatarConfig, type AvatarConfig } from "@/lib/avatar";
import { t, type Locale } from "@/lib/i18n/messages";

// ≥48px tap targets (docs/tasks/00b-cross-cutting-ui.md). Passed into the
// customiser's own option/colour/tab buttons via slotProps so the library's
// controls meet the same floor as the rest of the app.
const TAP_TARGET: CSSProperties = { minWidth: 48, minHeight: 48 };

// Section labels translated at author time (messages/*.json), keyed by the
// library's own section ids — EN/AR, never translated at render.
function sectionLabels(locale: Locale): Record<string, string> {
  return Object.fromEntries(
    REACT_NICE_AVATAR_SECTIONS.map((s) => [s.id, t(locale, `avatar.sections.${s.id}`)]),
  );
}

interface AvatarEditorProps {
  initialConfig: AvatarConfig;
  locale: Locale;
}

export function AvatarEditor({ initialConfig, locale }: AvatarEditorProps) {
  const router = useRouter();
  const [config, setConfig] = useState<AvatarConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function save() {
    setError(false);
    startTransition(async () => {
      const ok = await setAvatarConfigAction(config);
      if (ok) {
        router.push("/scout");
        router.refresh();
      } else {
        setError(true);
      }
    });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <AvatarCustomizeInline
        value={config}
        onChange={setConfig}
        labels={sectionLabels(locale)}
        layout="tabs"
        previewPosition="top"
        columns={4}
        // The built-in footer exports the avatar to PNG/SVG on save; we never
        // store a rendered image (docs/tasks/12-avatar.md), only the config,
        // so we hide it and drive save/cancel/shuffle ourselves below.
        components={{ Footer: () => null }}
        slotProps={{
          optionButton: { style: TAP_TARGET },
          colorButton: { style: TAP_TARGET },
          categoryTab: { style: { minHeight: 48 } },
        }}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {t(locale, "avatar.saveError")}
        </p>
      )}

      {/* Primary actions in the lower third, one-handed reach
          (00b-cross-cutting-ui.md). */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-60"
        >
          {t(locale, "avatar.save")}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfig(randomAvatarConfig())}
            disabled={isPending}
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base"
          >
            {t(locale, "avatar.randomize")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/scout")}
            disabled={isPending}
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-zinc-300 px-4 text-base"
          >
            {t(locale, "avatar.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
