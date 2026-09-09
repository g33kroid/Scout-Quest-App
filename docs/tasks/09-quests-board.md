# Task 09 — Quest model, prerequisites, scout board

## Scope

Quest authoring for leaders and the quest board for scouts.

## Architecture

- `quests` + `quest_translations` + `quest_prereqs` per Task 02.
- Leader authoring: title, flavour, description, tier (enum only), kind
  (solo/group), optional prerequisites, publish window.
- **No `mandatory` flag exists.** Gating is by prerequisite only.
- Scout board renders four states:
  - **available** — prerequisites met, published, not yet completed
  - **locked** — visible and greyed, prerequisites named
  - **completed** — with points earned
  - **expired/missed** — shown plainly, no shaming language
- Locked quests are **visible**. Visible-but-unreachable content is the core
  design device; never hide them.
- Board layout is a scrollable list in Wave 1. Pan/zoom map is Wave 3.

## Rules

- Point value comes from the tier enum. No free-text number in the authoring UI.
- A quest cannot be published without both locales (see Task 11).
- Prerequisites cannot form a cycle — validate server-side on save.
- A scout sees only quests published to their own unit.

## Test cases

- [ ] leader can create, edit, publish, and unpublish a quest in their unit
- [ ] leader cannot publish into another unit
- [ ] authoring UI offers no free-text point field (assert absence)
- [ ] a quest with an unmet prerequisite renders locked with the prereq named
- [ ] completing the prerequisite moves it to available without a reload artefact
- [ ] a cyclic prerequisite chain is rejected on save
- [ ] an expired quest moves to missed, not deleted
- [ ] scout cannot query an unpublished quest via the API directly
- [ ] scout cannot query another unit's quests via the API directly
- [ ] board renders correctly in Arabic RTL
- [ ] no `mandatory` column or flag exists anywhere (grep assertion)

## Done when

All tests pass and a seeded chain of 3 dependent quests unlocks correctly in
sequence for a test scout.
