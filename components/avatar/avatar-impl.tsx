"use client";

import Avatar, { genConfig } from "react-nice-avatar";
import type { AvatarConfig, ValidatedAvatarConfig } from "@/lib/avatar";

// The ONLY module that imports react-nice-avatar at runtime. Its bundled class
// component cannot be evaluated in Next's server graph nor server-rendered
// under Next 16, so this module is loaded exclusively through a dynamic
// ssr:false boundary (components/avatar-view.tsx, and the editor loader) and
// never statically imported by anything that renders on the server.

interface AvatarImplProps {
  // The scout's opaque id — deterministic seed for the default.
  seed: string;
  // Their saved config, or null to render the seeded default.
  config: ValidatedAvatarConfig | null;
  size: number;
}

export function AvatarImpl({ seed, config, size }: AvatarImplProps) {
  // A non-empty saved config wins; otherwise the deterministic default from
  // the seed (docs/tasks/12-avatar.md). Style fields validate as bounded
  // strings, wider than react-nice-avatar's literal unions, but the runtime
  // value is a real config — the renderer tolerates the rest.
  const resolved = (config as AvatarConfig | null) ?? genConfig(seed);
  return <Avatar style={{ width: size, height: size }} {...resolved} />;
}
