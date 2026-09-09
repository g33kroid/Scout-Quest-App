# Task 04 — Ledger and SECURITY DEFINER write path

## Scope

The append-only points ledger and the only sanctioned way to write to it.

## Architecture

All writes go through Postgres functions. Direct `INSERT`/`UPDATE`/`DELETE` on
`ledger` is revoked for every role.

```sql
award_points(
  p_person_ids uuid[],      -- one row per person, single transaction
  p_tier point_tier,        -- enum: minor|standard|major|epic
  p_reason ledger_reason,
  p_quest_id uuid,
  p_session_id uuid,
  p_idempotency_key text
) returns setof ledger
```

The function must validate server-side, not trust the caller:

- caller is a leader of the unit those scouts belong to (or admin)
- quest belongs to that unit and is published
- tier maps to points via a server-side lookup, never a client-supplied number
- every person is actively enrolled
- `p_idempotency_key` is unique — a replay returns the existing rows, does not
  insert again and does not error

```sql
reverse_ledger_entry(p_ledger_id uuid, p_reason text) returns ledger
```

Writes a compensating negative row. Never updates or deletes the original.

Totals are always computed:

```sql
create view person_totals as
  select person_id, sum(delta) as total from ledger group by person_id;
```

## Rules

- No `total_points` column, ever. If a later task wants one for performance, it
  is a materialised view refreshed on write, not a mutable column.
- A group award writes N rows in one transaction — all or nothing.
- Every award writes an `audit_log` row with the actor.

## Test cases

- [ ] direct INSERT into `ledger` as leader is refused
- [ ] direct UPDATE and DELETE are refused for every role including admin
- [ ] `award_points` with 12 person_ids writes exactly 12 rows atomically
- [ ] the same `p_idempotency_key` called twice writes 12 rows total, not 24
- [ ] a client-supplied point value cannot override the tier lookup
- [ ] leader awarding to a scout outside their unit is refused
- [ ] awarding against an unpublished quest is refused
- [ ] one invalid person_id in an array of 12 rolls back all 12
- [ ] `reverse_ledger_entry` leaves the original row untouched
- [ ] `person_totals` matches a hand-computed sum after a mixed award/reversal
- [ ] concurrent identical calls (same key) produce one set of rows

## Done when

All tests pass and the idempotency test survives 50 concurrent duplicate calls.
