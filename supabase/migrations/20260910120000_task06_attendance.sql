-- Task 06 — attendance and excused absences. `attendance` and its base RLS
-- landed in Task 02 as scaffolding; this closes the gaps docs/tasks/06-attendance.md
-- actually requires:
-- 1. It allowed at most one row per (person, session) and staff could UPDATE
--    it — not append-only. A correction must be a new row, the original
--    untouched.
-- 2. `excuse_category` had no `none_given` — a scout must never have to
--    disclose a reason to protect a streak.
-- 3. No derived views for "current status per session", the roster default
--    ("not marked present by session close defaults to absent"), or the two
--    dashboard rates (raw vs excused-adjusted) the leader dashboard needs.

-- ---------------------------------------------------------------------------
-- none_given: a first-class excuse category, not the absence of one.
-- ---------------------------------------------------------------------------
alter type public.excuse_category add value if not exists 'none_given';

-- The old check only forbade a category when NOT excused; it never required
-- one when excused. 'none_given' exists precisely so a category is always
-- chosen — silence is not an option.
alter table public.attendance
  add constraint attendance_excused_requires_category
  check (status <> 'excused' or excuse_category is not null);

-- ---------------------------------------------------------------------------
-- Append-only: drop the one-row-per-session constraint, and staff can only
-- ever INSERT, never UPDATE/DELETE — same shape as ledger/audit_log.
-- ---------------------------------------------------------------------------
alter table public.attendance drop constraint attendance_person_id_session_id_key;
create index on public.attendance (person_id, session_id, created_at desc);

drop policy attendance_write_staff on public.attendance;
create policy attendance_insert_staff on public.attendance for insert
with check (
  public.is_admin()
  or exists (
    select 1 from public.sessions s
    where s.id = attendance.session_id
      and public.is_leader_of_unit(s.unit_id)
  )
);

-- No UPDATE/DELETE policy exists for attendance any more (above), but RLS
-- alone only silently no-ops a blocked UPDATE/DELETE rather than raising —
-- revoke the grant too, same as ledger/audit_log, so a direct attempt is a
-- hard permission-denied error instead of a quiet 0-row statement.
revoke update, delete on public.attendance from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- attendance_current — latest row per (person, session). security_invoker so
-- it respects the querying role's own attendance RLS, not the view owner's
-- (migrations run as a superuser, which would otherwise bypass RLS entirely).
-- ---------------------------------------------------------------------------
create view public.attendance_current
with (security_invoker = true)
as
  select distinct on (person_id, session_id) *
  from public.attendance
  order by person_id, session_id, created_at desc, id desc;

grant select on public.attendance_current to authenticated;

-- ---------------------------------------------------------------------------
-- attendance_resolved — one row per (person, past session) they were
-- enrolled for, defaulting to 'absent' when nobody recorded anything by
-- session time. A scheduled-but-not-yet-happened session isn't a no-show
-- yet, so only sessions at or before now() are included.
-- ---------------------------------------------------------------------------
create view public.attendance_resolved
with (security_invoker = true)
as
  select
    ue.person_id,
    s.id as session_id,
    s.scheduled_at,
    coalesce(ac.status, 'absent'::public.attendance_status) as status,
    ac.excuse_category
  from public.sessions s
  join public.unit_enrollments ue
    on ue.unit_id = s.unit_id
    and ue.started_at <= s.scheduled_at
    and (ue.ended_at is null or ue.ended_at > s.scheduled_at)
  left join public.attendance_current ac
    on ac.person_id = ue.person_id and ac.session_id = s.id
  where s.scheduled_at <= now();

grant select on public.attendance_resolved to authenticated;

-- ---------------------------------------------------------------------------
-- attendance_rates — the two dashboard numbers ("analytics expose two
-- rates: raw, and excluding excused; the success metric uses raw") plus the
-- pastoral needs_attention flag. That flag counts TOTAL absences regardless
-- of reason — a scout excused six times running still surfaces, per
-- docs/tasks/06-attendance.md's own "done when" case.
-- ---------------------------------------------------------------------------
create view public.attendance_rates
with (security_invoker = true)
as
  select
    person_id,
    count(*)::int as total_sessions,
    count(*) filter (where status = 'present')::int as present_count,
    count(*) filter (where status = 'absent')::int as unexplained_absence_count,
    count(*) filter (where status = 'excused')::int as excused_count,
    count(*) filter (where status in ('absent', 'excused'))::int as total_absences,
    round(
      count(*) filter (where status = 'present')::numeric / nullif(count(*), 0), 4
    ) as raw_rate,
    round(
      count(*) filter (where status = 'present')::numeric
        / nullif(count(*) filter (where status <> 'excused'), 0), 4
    ) as excused_adjusted_rate,
    count(*) filter (where status in ('absent', 'excused')) >= 2 as needs_attention
  from public.attendance_resolved
  group by person_id;

grant select on public.attendance_rates to authenticated;

-- ---------------------------------------------------------------------------
-- attendance_streak — consecutive present sessions. An excused absence
-- freezes it (neither increments nor resets); an unexplained absence resets
-- it to zero. Inherently sequential, hence plpgsql over a window function.
-- ---------------------------------------------------------------------------
create or replace function public.attendance_streak(p_person_id uuid)
returns int
language plpgsql
stable
as $$
declare
  v_streak int := 0;
  v_status public.attendance_status;
begin
  for v_status in
    select status from public.attendance_resolved
    where person_id = p_person_id
    order by scheduled_at asc
  loop
    if v_status = 'present' then
      v_streak := v_streak + 1;
    elsif v_status = 'absent' then
      v_streak := 0;
    end if;
    -- 'excused' — frozen, no change.
  end loop;
  return v_streak;
end;
$$;

grant execute on function public.attendance_streak(uuid) to authenticated;
