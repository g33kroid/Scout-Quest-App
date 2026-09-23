-- Task 10 — journal. "No denormalised journal table" — everything here is
-- a view or a narrow function over ledger/attendance/quests/quest_prereqs
-- (Task 02/04/06/09). Active/Locked/Missed read directly from Task 09's
-- quest_board_state; this migration only adds what that view doesn't
-- already cover: completion detail (when, points) and the group-quest
-- "with whom" signal.
--
-- Teammate visibility: the task file says "lists teammates," but
-- CLAUDE.md's non-negotiable rule is "no chat, no messaging, no
-- scout-to-scout visibility, ever." Resolved (asked, not invented): a
-- completed group quest shows a teammate COUNT only, never names. A count
-- discloses nothing about who — same spirit as the pastoral signal
-- (Task 06) ignoring the excuse but never exposing it scout-to-scout.

-- ---------------------------------------------------------------------------
-- journal_completed — one row per (person, quest) ever awarded. sum(delta)
-- rather than assuming exactly one award row: correct regardless, and
-- costs nothing since nothing currently enforces "awarded at most once".
-- ---------------------------------------------------------------------------
create view public.journal_completed
with (security_invoker = true)
as
  select
    person_id,
    quest_id,
    min(created_at) as completed_at,
    sum(delta)::int as points_earned
  from public.ledger
  where reason = 'award' and quest_id is not null
  group by person_id, quest_id;

grant select on public.journal_completed to authenticated;

-- ---------------------------------------------------------------------------
-- journal_completed_teammate_count — a count, never names. SECURITY
-- DEFINER because a scout's own ledger_select policy (Task 04) does not
-- let them read another scout's ledger rows at all, even to count them —
-- this is the one narrow, identity-free exception. Self, admin, or the
-- scout's own leader only; anyone else gets 0, indistinguishable from "no
-- teammates" by design (same shape as every other authorization-via-filter
-- pattern in this codebase).
--
-- Two ledger rows are "the same award batch" when they share a quest_id
-- and created_at exactly — award_points() (Task 04) writes an entire batch
-- in one INSERT, and now() is evaluated once per statement in Postgres, so
-- every row in that batch carries the identical timestamp. No dependency
-- on parsing the idempotency key.
-- ---------------------------------------------------------------------------
create or replace function public.journal_completed_teammate_count(
  p_person_id uuid,
  p_quest_id uuid
)
returns int
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select count(distinct l2.person_id)::int
  from public.ledger l1
  join public.ledger l2
    on l2.quest_id = l1.quest_id
    and l2.created_at = l1.created_at
    and l2.reason = 'award'
  where l1.person_id = p_person_id
    and l1.quest_id = p_quest_id
    and l1.reason = 'award'
    and l2.person_id <> p_person_id
    and (
      p_person_id = public.current_uid()
      or public.is_admin()
      or exists (
        select 1 from public.unit_enrollments ue
        where ue.person_id = p_person_id
          and (ue.ended_at is null or ue.ended_at > now())
          and public.is_leader_of_unit(ue.unit_id)
      )
    )
$$;

grant execute on function public.journal_completed_teammate_count(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- patrol_totals — the home screen's "patrol contribution" stat: this
-- scout's own total against their patrol's. Active memberships only —
-- same shape as person_totals (Task 04), just grouped one level up.
-- ---------------------------------------------------------------------------
create view public.patrol_totals
with (security_invoker = true)
as
  select pm.patrol_id, sum(l.delta)::int as total
  from public.patrol_memberships pm
  join public.ledger l on l.person_id = pm.person_id and l.reason = 'award'
  where pm.ended_at is null
  group by pm.patrol_id;

grant select on public.patrol_totals to authenticated;
