-- Fix: `patrol_totals` (Task 10) is `security_invoker`, so when a scout
-- queries it themselves, the sum runs under their own `ledger_select` RLS —
-- which only exposes that scout's own rows, never a teammate's (Task 04).
-- The view silently returns "my total" relabelled as "patrol total" instead
-- of actually summing the patrol. The home screen's "own vs patrol" stat
-- needs the real cross-member sum, so it needs the same narrow,
-- identity-free SECURITY DEFINER exception as
-- journal_completed_teammate_count: visible to a current member of that
-- patrol, or the unit's leader/admin, count only (a total, never per-member
-- rows) — everyone else gets 0, indistinguishable from an empty patrol.
create or replace function public.patrol_total_for_scout(p_patrol_id uuid)
returns int
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(sum(l.delta), 0)::int
  from public.patrol_memberships pm
  join public.ledger l on l.person_id = pm.person_id and l.reason = 'award'
  where pm.patrol_id = p_patrol_id
    and pm.ended_at is null
    and (
      exists (
        select 1 from public.patrol_memberships mine
        where mine.person_id = public.current_uid()
          and mine.patrol_id = p_patrol_id
          and mine.ended_at is null
      )
      or public.is_admin()
      or exists (
        select 1 from public.patrols p
        where p.id = p_patrol_id and public.is_leader_of_unit(p.unit_id)
      )
    )
$$;

grant execute on function public.patrol_total_for_scout(uuid) to authenticated;
