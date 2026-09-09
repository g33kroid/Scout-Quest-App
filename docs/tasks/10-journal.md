# Task 10 — Journal

## Scope

The scout's permanent record — the feature that makes the app worth opening on a
Tuesday.

## Architecture

Five sections, all derived from existing tables, no new writes:

- **Active** — available quests with prerequisites shown
- **Completed** — what, when, with whom (for group quests), points earned
- **Missed** — expired or unchosen, plainly, without shaming language
- **Locked** — visible, greyed, prerequisites named
- **Achievements** — placeholder in Wave 1; badges land in Wave 2

Plus the personal home screen: own streak, own recent activity, patrol
contribution, next unlock. **Rankings are one tap away, never the landing view.**

## Rules

- Everything derives from `ledger`, `attendance`, and `quests`. No denormalised
  journal table.
- Survives unit promotion — closing one `unit_enrollment` and opening another must
  not orphan history.
- Both locales throughout.
- Missed content is framed as a path not taken. Review the copy specifically for
  this; it is easy to write shaming microcopy by accident.

## Test cases

- [ ] journal shows correct counts across all five sections on seeded data
- [ ] a scout promoted from unit A to unit B retains full history in both
- [ ] group quest completion lists teammates
- [ ] a scout sees only their own journal
- [ ] home screen shows no leaderboard position above the fold
- [ ] streak calculation is correct across an excused absence (frozen, not broken)
- [ ] renders correctly in Arabic RTL
- [ ] loads from cache with no network
- [ ] copy review: no shaming language in the missed section (manual gate, noted in PR)

## Done when

All tests pass and a seeded scout with two seasons of history renders correctly
after a simulated promotion.
