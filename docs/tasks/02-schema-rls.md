# Task 02 — Schema, RLS, pgTAP suite

## Scope

The full Wave 1 data model with row-level security, plus the test suite that
proves the policies hold.

## Tables

```
people              id (uuidv7), display_name, locale, avatar_config jsonb,
                    created_at, left_at
parent_contacts     person_id, name, relationship, phone, email,
                    may_collect bool, priority int
units               id, name_en, name_ar, grade_low, grade_high
unit_enrollments    person_id, unit_id, started_at, ended_at
patrols             id, unit_id, name_en, name_ar, season_id
patrol_memberships  person_id, patrol_id, started_at, ended_at
leaders             person_id, role enum(admin|leader), unit_id nullable
sessions            id, unit_id, scheduled_at, kind enum(class|camp_block)
quests              id, unit_id, tier enum, kind enum(solo|group),
                    published_at, expires_at, created_by
quest_translations  quest_id, locale, title, flavour, description
quest_prereqs       quest_id, requires_quest_id
ledger              id, person_id, delta int, reason enum, quest_id nullable,
                    session_id nullable, awarded_by, idempotency_key unique,
                    created_at
attendance          id, person_id, session_id, status enum(present|absent|excused),
                    excuse_category enum nullable, note text nullable,
                    recorded_by, created_at
audit_log           id, actor_id, action, subject_table, subject_id, created_at
```

Notes:

- `uuidv7` for all primary keys. No sequential integers.
- Never a `total_points` column anywhere.
- `parent_contacts` is a separate table by design, not columns on `people`.
- No column anywhere for medical or allergy data in Wave 1 — see open questions.

## RLS

Every table `ENABLE ROW LEVEL SECURITY` with no permissive default. Then:

- **scout**: reads own `people` row, own `ledger`, own `attendance`, own
  `patrol_memberships`, quests published to their unit, translations of those
  quests, patrol-mate display names and point totals only.
- **scout**: no access to `parent_contacts`, `audit_log`, other units, or any
  `leaders` row.
- **leader**: full read on scouts enrolled in their own unit, including
  `parent_contacts`. Write on `quests`, `attendance`, and ledger _via function
  only_.
- **admin**: read all, write all.
- **nobody** may `INSERT` or `UPDATE` `ledger` directly — revoke and rely on
  Task 04's functions.

## pgTAP test cases

Each must be an explicit failing-path assertion:

- [ ] scout cannot select another unit's `people`
- [ ] scout cannot select any `parent_contacts` row, including their own parent
- [ ] scout cannot select `audit_log`
- [ ] scout cannot select an unpublished quest
- [ ] scout cannot select a quest from another unit
- [ ] scout can select their own ledger rows and no others
- [ ] leader cannot select scouts outside their unit
- [ ] leader cannot select `parent_contacts` outside their unit
- [ ] leader cannot insert into `ledger` directly
- [ ] leader cannot update another leader's `quests`
- [ ] admin can read across units
- [ ] anon role can read nothing at all
- [ ] a scout whose `unit_enrollments.ended_at` is in the past loses unit access
- [ ] policies survive `supabase db reset` (suite runs green from scratch)

## Done when

Schema migrates cleanly, all pgTAP tests pass in CI, and `docs/schema.md`
contains the ERD plus a one-line statement of intent per policy.
