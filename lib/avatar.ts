// Shared avatar config — the pure, server-safe half. Validation and types
// only; NO runtime import of react-nice-avatar (its bundled class component
// breaks both `next build` page-data collection and server-side rendering
// under Next 16 — see components/avatar/avatar-impl.tsx, which quarantines the
// library to a client-only, ssr:false island). The genConfig-based helpers
// live there, because importing genConfig pulls the whole module in.
//
// `import type` is erased at build, so AvatarConfig costs nothing at runtime.
import { z } from "zod";
import type { AvatarConfig } from "react-nice-avatar";

export type { AvatarConfig };

// A hex colour as react-nice-avatar emits them (#rgb / #rrggbb). The style
// fields (hairStyle, eyeStyle, …) are left as bounded strings rather than
// pinned enums: the customiser is the only producer of valid values, and
// react-nice-avatar already falls back on anything it doesn't recognise, so
// the job here is only to keep a crafted RPC call from parking junk or bloat
// on the row — not to re-encode every enum the library owns.
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
const styleToken = z.string().min(1).max(32);

// Unknown keys are stripped (zod's object default), so a config can only ever
// carry the fields below back to the renderer.
export const avatarConfigSchema = z.object({
  sex: z.enum(["man", "woman"]).optional(),
  faceColor: hexColor.optional(),
  earSize: z.enum(["small", "big"]).optional(),
  hairColor: hexColor.optional(),
  hairStyle: styleToken.optional(),
  hairColorRandom: z.boolean().optional(),
  hatColor: hexColor.optional(),
  hatStyle: styleToken.optional(),
  eyeStyle: styleToken.optional(),
  eyeBrowStyle: styleToken.optional(),
  glassesStyle: styleToken.optional(),
  noseStyle: styleToken.optional(),
  mouthStyle: styleToken.optional(),
  shirtStyle: styleToken.optional(),
  shirtColor: hexColor.optional(),
  bgColor: z.string().min(1).max(64).optional(), // may be a gradient string
  isGradient: z.boolean().optional(),
});

export type ValidatedAvatarConfig = z.infer<typeof avatarConfigSchema>;

// Returns a clean config object, or null if the input isn't a usable avatar
// config (invalid, or an empty '{}' — a fresh scout's column default, treated
// as "not set yet"). Callers render the seeded default when this is null.
export function parseAvatarConfig(input: unknown): ValidatedAvatarConfig | null {
  const result = avatarConfigSchema.safeParse(input);
  if (!result.success || Object.keys(result.data).length === 0) return null;
  return result.data;
}
