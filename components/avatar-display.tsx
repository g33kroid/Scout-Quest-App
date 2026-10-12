import Avatar from "react-nice-avatar";
import type { AvatarConfig } from "@/lib/avatar";

interface AvatarDisplayProps {
  config: AvatarConfig;
  // Rendered pixel size (square). Default suits a roster row.
  size?: number;
}

// react-nice-avatar is a pure component (no hooks, no "use client"), so this
// renders inside Server Components — the roster and the scout home arrive as
// static SVG markup with no client JS and no network request for any avatar
// (docs/tasks/00b-cross-cutting-ui.md: "Avatars render from JSONB config — no
// image requests at all"). aria-hidden: an avatar is decorative, the scout's
// name is always the accessible label beside it.
export function AvatarDisplay({ config, size = 40 }: AvatarDisplayProps) {
  return (
    <span
      style={{ display: "inline-block", width: size, height: size }}
      aria-hidden="true"
    >
      <Avatar style={{ width: size, height: size }} {...config} />
    </span>
  );
}
