"use client";

import dynamic from "next/dynamic";
import type { ValidatedAvatarConfig } from "@/lib/avatar";
import type { Locale } from "@/lib/i18n/messages";

// react-nice-avatar (via react-avatar-studio and genConfig) can't be evaluated
// in Next 16's server graph, so the editor is a client-only island. The server
// page passes the raw seed + saved config; the editor resolves the default
// client-side (docs/tasks/12-avatar.md).
const AvatarEditor = dynamic(
  () => import("./avatar-editor").then((m) => m.AvatarEditor),
  {
    ssr: false,
    // Reserve the editor's vertical space while its chunk loads so Save/cancel
    // don't jump into place (00b-cross-cutting-ui.md: CLS < 0.1).
    loading: () => <div className="min-h-[60vh]" aria-busy="true" />,
  },
);

interface AvatarEditorLoaderProps {
  seed: string;
  config: ValidatedAvatarConfig | null;
  locale: Locale;
}

export function AvatarEditorLoader(props: AvatarEditorLoaderProps) {
  return <AvatarEditor {...props} />;
}
