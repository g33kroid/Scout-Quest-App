"use client";

import dynamic from "next/dynamic";
import type { ValidatedAvatarConfig } from "@/lib/avatar";

interface AvatarViewProps {
  // The scout's opaque id — deterministic seed for the default.
  seed: string;
  // Their saved config, or null to render the seeded default.
  config: ValidatedAvatarConfig | null;
  // Rendered pixel size (square). Default suits a roster row.
  size?: number;
}

// Loaded once, at module scope: react-nice-avatar renders only in the browser
// (its class component is server-hostile under Next 16 — see
// components/avatar/avatar-impl.tsx), so the actual avatar is a client-only
// island. Avatars are inline SVG from JSONB config — no image request on any
// path (00b-cross-cutting-ui.md caching table).
const AvatarImpl = dynamic(
  () => import("@/components/avatar/avatar-impl").then((m) => m.AvatarImpl),
  { ssr: false },
);

// The outer span reserves the exact box so nothing shifts when the avatar
// mounts (00b: CLS < 0.1).
export function AvatarView({ seed, config, size = 40 }: AvatarViewProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <AvatarImpl seed={seed} config={config} size={size} />
    </span>
  );
}
