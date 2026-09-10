-- Task 04 — ledger SECURITY DEFINER write path. No new tables: `ledger`,
-- `quests`, `unit_enrollments`, `audit_log` and the RLS/auth helpers all
-- already exist (Task 02/03). This is the only sanctioned way to write to
-- `ledger` — direct INSERT/UPDATE/DELETE stays revoked from every role.
--
-- docs/tasks/04-ledger.md's award_points() signature names the tier
-- parameter `point_tier` — reused public.quest_tier (Task 02) instead of
-- adding a duplicate enum with the same four values.

-- ---------------------------------------------------------------------------
-- award_points — the only way points ever get written. A group award is one
-- INSERT, one transaction: all rows land or none do (a raise anywhere above
-- aborts the whole call, Postgres rolls back the lot).
--
-- Idempotency: the caller passes ONE key for the whole batch, but `ledger`'s
-- UNIQUE constraint is per-row — so each row's stored key is derived as
-- `p_idempotency_key || ':' || person_id`. A replay (same key, same people)
-- produces the same derived keys, `ON CONFLICT DO NOTHING` skips the
-- duplicates, and the final SELECT returns the full row set either way —
-- correct under real concurrency (the UNIQUE constraint is enforced by
-- Postgres itself, not by any lock this function takes).
-- ---------------------------------------------------------------------------
create or replace function public.award_points(
  p_person_ids uuid[],
  p_tier public.quest_tier,
  p_reason public.ledger_reason,
  p_quest_id uuid,
  p_session_id uuid,
  p_idempotency_key text
)
returns setof public.ledger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_delta int;
  v_quest_unit_id uuid;
  v_person_id uuid;
  v_person_unit_id uuid;
begin
  if p_reason <> 'award' then
    raise exception 'award_points only writes award entries, got %', p_reason;
  end if;

  if p_person_ids is null or array_length(p_person_ids, 1) is null then
    raise exception 'award_points requires at least one person_id';
  end if;

  -- Tier -> points, server-side only. A client can never supply a raw
  -- number — this CASE is the entire mapping.
  v_delta := case p_tier
    when 'minor' then 10
    when 'standard' then 25
    when 'major' then 50
    when 'epic' then 100
  end;

  if p_quest_id is not null then
    select unit_id into v_quest_unit_id
    from public.quests
    where id = p_quest_id
      and published_at is not null
      and (expires_at is null or expires_at > now());

    if v_quest_unit_id is null then
      raise exception 'quest % does not exist, is unpublished, or has expired', p_quest_id;
    end if;
  end if;

  -- Validate every person before writing anything. One bad id anywhere in
  -- the array raises here, which aborts the whole function call — this is
  -- what makes a group award all-or-nothing.
  foreach v_person_id in array p_person_ids loop
    select ue.unit_id into v_person_unit_id
    from public.unit_enrollments ue
    where ue.person_id = v_person_id
      and (ue.ended_at is null or ue.ended_at > now())
    limit 1;

    if v_person_unit_id is null then
      raise exception 'person % is not actively enrolled in any unit', v_person_id;
    end if;

    if not public.is_admin_or_leader_of(v_person_unit_id) then
      raise exception 'not authorised to award points to person %', v_person_id;
    end if;

    if p_quest_id is not null and v_quest_unit_id <> v_person_unit_id then
      raise exception 'quest % does not belong to person %''s unit', p_quest_id, v_person_id;
    end if;
  end loop;

  insert into public.ledger (person_id, delta, reason, quest_id, session_id, awarded_by, idempotency_key)
  select pid, v_delta, p_reason, p_quest_id, p_session_id, public.current_uid(),
         p_idempotency_key || ':' || pid::text
  from unnest(p_person_ids) as pid
  on conflict (idempotency_key) do nothing;

  perform public.log_audit_event(public.current_uid(), 'ledger_award', 'ledger', p_quest_id);

  return query
  select l.* from public.ledger l
  join unnest(p_person_ids) as pid on l.idempotency_key = p_idempotency_key || ':' || pid::text;
end;
$$;

grant execute on function public.award_points(uuid[], public.quest_tier, public.ledger_reason, uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- reverse_ledger_entry — a compensating negative row, never an edit/delete
-- of the original. Only reverses 'award' entries: 'attendance' rows carry
-- delta=0 (nothing to compensate) and reversing a 'correction' would need
-- its own compensating chain, not supported here.
--
-- Idempotent the same way award_points is: the derived key
-- `reverse:<ledger_id>` means calling this twice on the same entry returns
-- the same reversal row rather than writing (or erroring) twice.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_ledger_entry(p_ledger_id uuid, p_reason text)
returns public.ledger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_original public.ledger;
  v_unit_id uuid;
  v_key text;
begin
  select * into v_original from public.ledger where id = p_ledger_id;
  if v_original is null then
    raise exception 'ledger entry % not found', p_ledger_id;
  end if;

  if v_original.reason <> 'award' then
    raise exception 'can only reverse an award entry, got %', v_original.reason;
  end if;

  select ue.unit_id into v_unit_id
  from public.unit_enrollments ue
  where ue.person_id = v_original.person_id
    and (ue.ended_at is null or ue.ended_at > now())
  limit 1;

  if not public.is_admin_or_leader_of(v_unit_id) then
    raise exception 'not authorised to reverse this ledger entry';
  end if;

  v_key := 'reverse:' || p_ledger_id::text;

  insert into public.ledger (person_id, delta, reason, quest_id, session_id, awarded_by, idempotency_key)
  values (
    v_original.person_id, -v_original.delta, 'correction',
    v_original.quest_id, v_original.session_id, public.current_uid(), v_key
  )
  on conflict (idempotency_key) do nothing;

  perform public.log_audit_event(public.current_uid(), 'ledger_reversal:' || p_reason, 'ledger', p_ledger_id);

  return (select l from public.ledger l where l.idempotency_key = v_key);
end;
$$;

grant execute on function public.reverse_ledger_entry(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- person_totals — the only place a "total" exists, and it's always a SUM,
-- never a column. security_invoker: without it a view runs with the OWNER's
-- privileges (bypassing RLS entirely, since migrations run as a superuser) —
-- this makes it respect the querying role's own ledger RLS instead.
-- ---------------------------------------------------------------------------
create view public.person_totals
with (security_invoker = true)
as
  select person_id, sum(delta)::int as total
  from public.ledger
  group by person_id;

grant select on public.person_totals to authenticated;
