// Shared avatar config — imported by both the client customiser
// (app/scout/avatar/avatar-editor.tsx) and the server write path
// (lib/server/avatar.ts), so no "server-only" here.
//
// docs/tasks/12-avatar.md: the avatar is stored as a JSONB config object on
// people.avatar_config, never a rendered image. react-nice-avatar's genConfig
// is the generator; AvatarConfig is its shape. genConfig(seed) is
// deterministic for a given string, so a scout's opaque id produces the same
// sensible default everywhere before they touch anything.
import { z } from "zod";
import { genConfig, type AvatarConfig } from "react-nice-avatar";

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

type ValidatedAvatarConfig = z.infer<typeof avatarConfigSchema>;

// Returns a clean config object, or null if the input isn't a usable avatar
// config. Callers treat null as "fall back to the default".
export function parseAvatarConfig(input: unknown): ValidatedAvatarConfig | null {
  const result = avatarConfigSchema.safeParse(input);
  return result.success ? result.data : null;
}

// Deterministic default seeded from the scout's opaque id.
export function defaultAvatarConfig(seed: string): AvatarConfig {
  return genConfig(seed);
}

// A fresh random config — the "shuffle" button in the customiser. Unseeded,
// so it differs each call.
export function randomAvatarConfig(): AvatarConfig {
  return genConfig();
}

// The config to render for a person: their saved one if it's a usable avatar
// (a non-empty, valid object), otherwise the deterministic default from their
// id. A fresh scout's column defaults to '{}', which parses to an empty object
// — treated as "not set yet" so they still get a seeded avatar.
export function resolveAvatarConfig(seed: string, saved: unknown): AvatarConfig {
  const parsed = parseAvatarConfig(saved);
  // Style fields validate as bounded strings (see avatarConfigSchema), which
  // is deliberately wider than react-nice-avatar's literal unions — the
  // customiser only ever produces valid tokens and the renderer tolerates the
  // rest, so the runtime value is a real AvatarConfig.
  if (parsed && Object.keys(parsed).length > 0) return parsed as AvatarConfig;
  return defaultAvatarConfig(seed);
}
