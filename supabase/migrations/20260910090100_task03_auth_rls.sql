-- Task 03 — auth RLS + SECURITY DEFINER functions.
--
-- Foundational assumption made explicit here (was implicit since Task 02):
-- `people.id` IS the GoTrue `auth.users.id`, for scouts and leaders alike.
-- `current_uid()` reads the JWT `sub` claim directly into `people.id`
-- comparisons everywhere — that only works if they're the same UUID.
-- Every scout gets an `auth.users` row at enrollment (Task 14) with a
-- synthetic, never-disclosed email; the PIN never touches GoTrue at all.
--
-- Nobody touches scout_credentials, join_codes' raw rows, or ip_rate_limits
-- directly — every read/write in the login path goes through a SECURITY
-- DEFINER function below, callable by `anon` (login is necessarily
-- pre-session) but scoped to exactly one narrow operation each.

alter table public.scout_credentials enable row level security;
alter table public.join_codes enable row level security;
alter table public.ip_rate_limits enable row level security;

-- Admin-only direct read (support/debugging); everything else via functions.
create policy scout_credentials_select_admin on public.scout_credentials for select
using (public.is_admin());
revoke insert, update, delete on public.scout_credentials from authenticated, anon, public;

create policy join_codes_select on public.join_codes for select
using (public.is_admin_or_leader_of(unit_id));
create policy join_codes_write on public.join_codes for all
using (public.is_admin_or_leader_of(unit_id))
with check (public.is_admin_or_leader_of(unit_id));
-- The login flow reads a code by string, as `anon`, via verify_join_code()
-- below — never a raw table grant for anon.

create policy ip_rate_limits_select_admin on public.ip_rate_limits for select
using (public.is_admin());
revoke insert, update, delete on public.ip_rate_limits from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- General-purpose audit write. Every failed-authorisation and login-outcome
-- function below calls this instead of writing audit_log itself.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event(
  p_actor_id uuid,
  p_action text,
  p_subject_table text,
  p_subject_id uuid
)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  insert into public.audit_log (actor_id, action, subject_table, subject_id)
  values (p_actor_id, p_action, p_subject_table, p_subject_id)
$$;

grant execute on function public.log_audit_event(uuid, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Escalating lockout duration: 15 minutes, doubling per repeat lockout,
-- capped at 24 hours. docs/tasks/03-auth.md: "15 minute lock, escalating
-- on repeat" — no formula given, this is the interpretation; flagged in
-- docs/schema.md as a judgment call.
-- ---------------------------------------------------------------------------
create or replace function public.next_lockout_duration(p_lockout_count int)
returns interval
language sql
immutable
as $$
  select least(
    interval '15 minutes' * power(2, greatest(p_lockout_count, 0)),
    interval '24 hours'
  )
$$;

-- ---------------------------------------------------------------------------
-- Scout login: join code -> unit, unit + nickname -> candidate, precheck
-- lock state, then (in the app layer) verify the PIN, then record.
-- ---------------------------------------------------------------------------

-- Returns the unit_id for a live (unexpired) join code, or null.
create or replace function public.verify_join_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select unit_id from public.join_codes
  where code = p_code and expires_at > now()
  limit 1
$$;

-- Returns the one scout matching (unit, nickname) for login purposes, or
-- null if zero or more than one match. Nickname uniqueness within a unit's
-- active enrollment isn't a DB constraint (Task 02 didn't add one) — an
-- ambiguous match fails closed here rather than guessing. Task 14 (scout
-- creation) should enforce uniqueness at write time so this is never hit.
create or replace function public.find_scout_for_login(p_unit_id uuid, p_nickname text)
returns table (person_id uuid, pin_hash text, failed_attempts int, locked_until timestamptz)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with matches as (
    select sc.person_id, sc.pin_hash, sc.failed_attempts, sc.locked_until
    from public.people p
    join public.unit_enrollments ue on ue.person_id = p.id
    join public.scout_credentials sc on sc.person_id = p.id
    where ue.unit_id = p_unit_id
      and (ue.ended_at is null or ue.ended_at > now())
      and lower(p.display_name) = lower(p_nickname)
  )
  select * from matches where (select count(*) from matches) = 1
$$;

-- Pure read: is this person or this IP currently locked out? Checked BEFORE
-- verifying a PIN, so a locked-out attempt never even reaches argon2 verify
-- — this is what makes "6th attempt with the correct PIN is refused" hold.
create or replace function public.scout_login_is_locked(p_person_id uuid, p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    exists (
      select 1 from public.scout_credentials
      where person_id = p_person_id and locked_until > now()
    )
    or exists (
      select 1 from public.ip_rate_limits
      where ip = p_ip and scope = 'scout_pin_login' and locked_until > now()
    )
$$;

-- Records a scout login outcome atomically per axis (person, IP) and audits
-- it. Row-level UPDATE locking makes the increment-then-maybe-lock step safe
-- under concurrent attempts without a separate advisory lock.
create or replace function public.scout_login_record(
  p_person_id uuid,
  p_ip inet,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_person_attempts int;
  v_person_lockout_count int;
  v_ip_attempts int;
  v_ip_lockout_count int;
begin
  if p_success then
    update public.scout_credentials
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where person_id = p_person_id;

    update public.ip_rate_limits
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where ip = p_ip and scope = 'scout_pin_login';

    perform public.log_audit_event(p_person_id, 'scout_login_success', 'people', p_person_id);
    return;
  end if;

  update public.scout_credentials
  set failed_attempts = failed_attempts + 1, updated_at = now()
  where person_id = p_person_id
  returning failed_attempts, lockout_count into v_person_attempts, v_person_lockout_count;

  if v_person_attempts >= 5 then
    update public.scout_credentials
    set failed_attempts = 0,
        lockout_count = lockout_count + 1,
        locked_until = now() + public.next_lockout_duration(lockout_count)
    where person_id = p_person_id;
  end if;

  insert into public.ip_rate_limits (ip, scope, failed_attempts, updated_at)
  values (p_ip, 'scout_pin_login', 1, now())
  on conflict (ip, scope) do update
    set failed_attempts = public.ip_rate_limits.failed_attempts + 1, updated_at = now()
  returning failed_attempts, lockout_count into v_ip_attempts, v_ip_lockout_count;

  if v_ip_attempts >= 5 then
    update public.ip_rate_limits
    set failed_attempts = 0,
        lockout_count = lockout_count + 1,
        locked_until = now() + public.next_lockout_duration(lockout_count)
    where ip = p_ip and scope = 'scout_pin_login';
  end if;

  perform public.log_audit_event(p_person_id, 'scout_login_failed', 'people', p_person_id);
end;
$$;

grant execute on function public.verify_join_code(text) to anon, authenticated;
grant execute on function public.find_scout_for_login(uuid, text) to anon, authenticated;
grant execute on function public.scout_login_is_locked(uuid, inet) to anon, authenticated;
grant execute on function public.scout_login_record(uuid, inet, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leader login: GoTrue verifies the password itself (server action calls
-- the Supabase Auth API, not this function) — we only own the IP-side rate
-- limit and the audit trail, since GoTrue has no per-org custom lockout.
-- ---------------------------------------------------------------------------
create or replace function public.leader_login_is_locked(p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.ip_rate_limits
    where ip = p_ip and scope = 'leader_login' and locked_until > now()
  )
$$;

create or replace function public.leader_login_record(
  p_email text,
  p_ip inet,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = auth, public, extensions, pg_temp
as $$
declare
  v_person_id uuid;
  v_ip_attempts int;
  v_ip_lockout_count int;
begin
  select id into v_person_id from auth.users where email = p_email;

  if p_success then
    update public.ip_rate_limits
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where ip = p_ip and scope = 'leader_login';

    perform public.log_audit_event(v_person_id, 'leader_login_success', 'people', v_person_id);
    return;
  end if;

  insert into public.ip_rate_limits (ip, scope, failed_attempts, updated_at)
  values (p_ip, 'leader_login', 1, now())
  on conflict (ip, scope) do update
    set failed_attempts = public.ip_rate_limits.failed_attempts + 1, updated_at = now()
  returning failed_attempts, lockout_count into v_ip_attempts, v_ip_lockout_count;

  if v_ip_attempts >= 5 then
    update public.ip_rate_limits
    set failed_attempts = 0,
        lockout_count = lockout_count + 1,
        locked_until = now() + public.next_lockout_duration(lockout_count)
    where ip = p_ip and scope = 'leader_login';
  end if;

  perform public.log_audit_event(v_person_id, 'leader_login_failed', 'people', v_person_id);
end;
$$;

grant execute on function public.leader_login_is_locked(inet) to anon, authenticated;
grant execute on function public.leader_login_record(text, inet, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PIN reset — leader action only, never self-service (docs/tasks/03-auth.md).
-- Clears lockout state too, so a reset also un-sticks a locked-out scout.
-- ---------------------------------------------------------------------------
create or replace function public.leader_reset_scout_pin(
  p_person_id uuid,
  p_new_pin_hash text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_unit_id uuid;
begin
  select ue.unit_id into v_unit_id
  from public.unit_enrollments ue
  where ue.person_id = p_person_id
    and (ue.ended_at is null or ue.ended_at > now())
  limit 1;

  if not public.is_admin_or_leader_of(v_unit_id) then
    raise exception 'not authorised to reset this scout''s PIN';
  end if;

  update public.scout_credentials
  set pin_hash = p_new_pin_hash,
      failed_attempts = 0,
      lockout_count = 0,
      locked_until = null,
      updated_at = now()
  where person_id = p_person_id;

  perform public.log_audit_event(public.current_uid(), 'scout_pin_reset', 'people', p_person_id);
end;
$$;

grant execute on function public.leader_reset_scout_pin(uuid, text) to authenticated;
