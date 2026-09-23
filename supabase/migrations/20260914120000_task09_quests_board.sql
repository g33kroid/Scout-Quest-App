-- Task 09 — quest prerequisites and the scout board. `quests`,
-- `quest_translations`, `quest_prereqs` and their RLS were all scaffolded
-- in Task 02, including the "publish requires both locales" trigger — this
-- migration adds the two things that were still missing:
-- 1. Server-side cycle rejection on quest_prereqs (nothing enforced this yet).
-- 2. quest_board_state — the derived view the scout board actually renders
--    from (available/locked/completed/expired), same shape as Task 06's
--    attendance_resolved: nothing is stored, everything is computed live.

-- ---------------------------------------------------------------------------
-- Cycle rejection. A cycle exists exactly when requires_quest_id can
-- already (transitively) reach quest_id through existing edges — adding
-- quest_id -> requires_quest_id would close that loop.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_quest_prereq_no_cycle()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive reachable(id) as (
      select requires_quest_id from public.quest_prereqs where quest_id = new.requires_quest_id
      union
      select qp.requires_quest_id
      from public.quest_prereqs qp
      join reachable r on qp.quest_id = r.id
    )
    select 1 from reachable where id = new.quest_id
  ) then
    raise exception 'prerequisite % -> % would create a cycle', new.quest_id, new.requires_quest_id;
  end if;
  return new;
end;
$$;

create trigger quest_prereqs_no_cycle
  before insert on public.quest_prereqs
  for each row execute function public.enforce_quest_prereq_no_cycle();

-- ---------------------------------------------------------------------------
-- quest_board_state — one row per (enrolled scout, published quest in their
-- unit). "Completed" is derived from the ledger (an award tied to this
-- quest_id for this person), same as everywhere else in this codebase:
-- never a separate stored completion flag. security_invoker so it respects
-- the querying role's own RLS on quests/quest_prereqs/ledger/unit_enrollments.
-- ---------------------------------------------------------------------------
create view public.quest_board_state
with (security_invoker = true)
as
  select
    ue.person_id,
    q.id as quest_id,
    q.unit_id,
    case
      when exists (
        select 1 from public.ledger l
        where l.person_id = ue.person_id and l.quest_id = q.id and l.reason = 'award'
      ) then 'completed'
      when q.expires_at is not null and q.expires_at <= now() then 'expired'
      when exists (
        select 1 from public.quest_prereqs qp
        where qp.quest_id = q.id
          and not exists (
            select 1 from public.ledger l2
            where l2.person_id = ue.person_id and l2.quest_id = qp.requires_quest_id and l2.reason = 'award'
          )
      ) then 'locked'
      else 'available'
    end as state,
    -- Locked quests are visible with their prerequisites named (rule: never
    -- hide them) — the app layer resolves these ids to translated titles.
    (
      select array_agg(qp.requires_quest_id)
      from public.quest_prereqs qp
      where qp.quest_id = q.id
        and not exists (
          select 1 from public.ledger l3
          where l3.person_id = ue.person_id and l3.quest_id = qp.requires_quest_id and l3.reason = 'award'
        )
    ) as unmet_prereq_ids
  from public.quests q
  join public.unit_enrollments ue
    on ue.unit_id = q.unit_id
    and (ue.ended_at is null or ue.ended_at > now())
  where q.published_at is not null;

grant select on public.quest_board_state to authenticated;

-- ---------------------------------------------------------------------------
-- Fix: the Task 02 SELECT policies on quests/quest_translations/quest_prereqs
-- hid an expired quest from a scout entirely (expires_at > now() in the
-- USING clause). That directly contradicts this task's own rule — "an
-- expired quest moves to missed, not deleted" — a scout must still be able
-- to see it (quest_board_state renders it as 'expired'), just not act on
-- it. Visibility is now published_at is not null only; expiry is business
-- state the view computes, not an RLS concern.
-- ---------------------------------------------------------------------------
drop policy quests_select on public.quests;
create policy quests_select on public.quests for select
using (
  public.is_admin()
  or public.is_leader_of_unit(unit_id)
  or (public.is_enrolled_in_unit(unit_id) and published_at is not null)
);

drop policy quest_translations_select on public.quest_translations;
create policy quest_translations_select on public.quest_translations for select
using (
  exists (
    select 1 from public.quests q
    where q.id = quest_translations.quest_id
      and (
        public.is_admin()
        or public.is_leader_of_unit(q.unit_id)
        or (public.is_enrolled_in_unit(q.unit_id) and q.published_at is not null)
      )
  )
);

drop policy quest_prereqs_select on public.quest_prereqs;
create policy quest_prereqs_select on public.quest_prereqs for select
using (
  exists (
    select 1 from public.quests q
    where q.id = quest_prereqs.quest_id
      and (
        public.is_admin()
        or public.is_leader_of_unit(q.unit_id)
        or (public.is_enrolled_in_unit(q.unit_id) and q.published_at is not null)
      )
  )
);
