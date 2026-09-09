# Task 05 — Leader scoring flow (the 15-second screen)

## Scope

**The single most important screen in the project.** A prior management system
failed here and leaders reverted to Excel. Build this before any scout-facing UI.

## The requirement

Open app → the leader's current session roster is _already_ the home screen →
tap scouts → tap tier → confirm. **Under 15 seconds, on their own phone, with no
navigation and no search.**

## Architecture

- Leader home route resolves the "current context" server-side: today's session
  for their unit, or the active camp station if one is assigned. No picker if
  there is exactly one candidate.
- Roster is a single scrollable list of large tap targets: avatar, first name,
  today's status. Multi-select by tapping. Selection count pinned in a bottom bar.
- Bottom bar: four tier buttons and a confirm. One tap to award the selected set.
- Optimistic UI — the award appears instantly, queued for sync (Task 08).
- No dropdowns. No modals in the happy path. No free-text point entry.
- Target: every interactive element ≥ 48px, reachable one-handed.

## Out of scope

Quest authoring, analytics, scout views, QR (Task 07).

## Test cases

- [ ] **Stopwatch test**: award a tier to 8 scouts in under 15 seconds, measured
      on a real mid-range Android phone, from cold app open. Record the number in
      the PR description.
- [ ] roster loads with zero taps when the leader has exactly one active session
- [ ] leader with two concurrent assignments gets a one-tap chooser, not a menu
- [ ] selecting 12 scouts and awarding writes exactly 12 ledger rows
- [ ] double-tapping confirm does not double-award
- [ ] award appears optimistically and reconciles after sync
- [ ] a failed award surfaces a retry, never a silent loss
- [ ] all tap targets ≥ 48px (automated check)
- [ ] works in Arabic with RTL layout mirrored
- [ ] E2E on a 375px viewport

## Done when

The stopwatch test passes **and a real leader has used it once on their own
phone without instruction.** That second condition is not optional.
