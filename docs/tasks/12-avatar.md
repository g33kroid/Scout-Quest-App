# Task 12 — Avatar builder

## Scope

Scout builds and edits their own avatar. The one pre-built component in Wave 1.

## Architecture

- `react-avatar-studio` for the customiser UI, `react-nice-avatar` underneath.
- **Store the config object as JSONB** on `people.avatar_config`. Never store a
  rendered image. No uploads, no image storage, no moderation surface — which is
  exactly what you want in a system holding children's records.
- `genConfig` seeded from the scout's opaque id gives everyone a sensible default
  before they touch anything.
- Render server-side for leader rosters so 30 avatars in a list stay cheap.
- Pin the package version exactly. Consider vendoring.

## Rules

- No photo upload path anywhere in Wave 1.
- Avatar config is readable by the scout, their unit leaders, and patrol-mates
  (for rosters and standings). Nothing else.
- The customiser must work in RTL.

## Test cases

- [ ] a new scout gets a deterministic default avatar from their id
- [ ] editing and saving persists the config as JSONB
- [ ] the same config renders identically across devices
- [ ] no image bytes are written to storage on any path
- [ ] leader roster renders 30 avatars without a visible performance hit
- [ ] customiser is usable one-handed on a 375px viewport
- [ ] customiser renders correctly in RTL
- [ ] a scout cannot modify another scout's avatar_config
- [ ] the pinned version is exact in the lockfile (no caret)

## Done when

All tests pass and a 30-avatar roster renders in under 200ms on a mid-range
Android device.
