# Task 14 — Seed template library and admin views

## Scope

The reusable quest library that keeps 20 leaders producing consistent content,
plus the minimum admin tooling to run a season.

## Architecture

- `quest_templates` mirroring `quests` but unpublished and unit-agnostic, with
  translations in both locales.
- Leader flow: browse library → clone into own unit → adjust → publish. Cloning
  copies both locales so the translate step is usually unnecessary.
- 30–40 seeded templates covering typical weekly-class and camp activities,
  authored in English and Arabic.

## Admin views (minimum viable)

- Add/remove a leader, assign to a unit
- Create a unit, create patrols, assign scouts to patrols
- Promote a scout between units (closes one enrollment, opens another)
- Issue and expire join codes
- Reset a scout PIN
- **Export a scout** — full record, both locales, machine-readable
- **Delete a scout** — hard delete including storage objects, with confirmation
- View `audit_log` filtered by subject

## Rules

- Export and delete must both work before go-live. They are PDPL obligations, not
  conveniences.
- Delete removes storage objects, not just database rows.
- Every admin action writes an audit row.

## Test cases

- [ ] cloning a template creates an editable unpublished quest with both locales
- [ ] editing a clone does not modify the template
- [ ] promoting a scout preserves ledger, attendance, and journal history
- [ ] promoting a scout revokes access to the old unit's quests
- [ ] export produces a complete record including ledger and attendance
- [ ] delete removes person, ledger, attendance, materials, and storage objects
- [ ] delete of a scout does not corrupt patrol averages for remaining members
- [ ] a leader cannot reach any admin route
- [ ] all 40 seed templates have both locales (assertion over seed data)
- [ ] every admin action appears in `audit_log`

## Done when

All tests pass and a full create → award → export → delete cycle leaves no
orphaned rows or storage objects.
