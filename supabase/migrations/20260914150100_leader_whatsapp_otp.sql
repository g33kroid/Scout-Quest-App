-- Replaces leader mandatory TOTP (authenticator app, Task 03) with a
-- WhatsApp-delivered 6-digit OTP — a deliberate decision to drop the
-- authenticator-app requirement, made after Task 03 shipped, not part of
-- the original 15-task plan. See app/leader/actions.ts / lib/server for
-- the send/verify flow this table and these functions exist to support.
--
-- Same shape as scout PIN auth throughout: argon2id hashing happens in
-- Node (Postgres has no argon2 primitive), this migration only stores the
-- hash and does rate-limit bookkeeping via SECURITY DEFINER functions.
-- Nobody gets direct table access, same as scout_credentials.

alter table public.leaders
  add column whatsapp_number text;

create table public.leader_otp_challenges (
  id uuid primary key default public.uuid_generate_v7(),
  person_id uuid not null references public.people (id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.leader_otp_challenges (person_id, created_at desc);

alter table public.leader_otp_challenges enable row level security;
revoke insert, update, delete, select on public.leader_otp_challenges from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- leader_generate_otp_challenge — called right after password auth
-- succeeds, by the now-authenticated leader for themselves only. Any prior
-- unconsumed challenge for this person is superseded (expired outright) so
-- an old code from a previous login attempt can never be replayed once a
-- fresh one is requested.
-- ---------------------------------------------------------------------------
create or replace function public.leader_generate_otp_challenge(
  p_person_id uuid,
  p_code_hash text,
  p_ttl_seconds int default 300
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_person_id <> public.current_uid() then
    raise exception 'can only generate an OTP challenge for yourself';
  end if;

  update public.leader_otp_challenges
  set expires_at = now()
  where person_id = p_person_id and consumed_at is null and expires_at > now();

  insert into public.leader_otp_challenges (person_id, code_hash, expires_at)
  values (p_person_id, p_code_hash, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.leader_generate_otp_challenge(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- leader_get_active_otp_challenge — the app layer fetches the stored hash
-- here, verifies the leader's typed code against it with argon2 in Node
-- (same split as scout PIN verification), then calls
-- leader_otp_verify_record with the outcome.
-- ---------------------------------------------------------------------------
create or replace function public.leader_get_active_otp_challenge(p_person_id uuid)
returns table (id uuid, code_hash text, attempts int)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select c.id, c.code_hash, c.attempts
  from public.leader_otp_challenges c
  where c.person_id = p_person_id
    and p_person_id = public.current_uid()
    and c.consumed_at is null
    and c.expires_at > now()
  order by c.created_at desc
  limit 1
$$;

grant execute on function public.leader_get_active_otp_challenge(uuid) to authenticated;

-- Pure read, checked before generating or accepting a code — same "fail
-- before doing expensive work" shape as scout_login_is_locked.
create or replace function public.leader_otp_is_locked(p_person_id uuid, p_ip inet)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.ip_rate_limits
    where ip = p_ip and scope = 'leader_otp_verify' and locked_until > now()
  )
$$;

-- Records a verify attempt. Success consumes the challenge and clears the
-- IP counter; failure increments both the per-challenge attempt count (5
-- wrong guesses kills that specific code outright — a fresh one must be
-- requested) and the IP-wide escalating lockout (same formula as every
-- other login surface in this codebase).
create or replace function public.leader_otp_verify_record(
  p_challenge_id uuid,
  p_ip inet,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_person_id uuid;
  v_ip_attempts int;
  v_ip_lockout_count int;
begin
  select person_id into v_person_id
  from public.leader_otp_challenges
  where id = p_challenge_id;

  if v_person_id is null or v_person_id <> public.current_uid() then
    raise exception 'not authorised to record this OTP attempt';
  end if;

  if p_success then
    update public.leader_otp_challenges
    set consumed_at = now()
    where id = p_challenge_id;

    update public.ip_rate_limits
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where ip = p_ip and scope = 'leader_otp_verify';

    perform public.log_audit_event(v_person_id, 'leader_otp_success', 'people', v_person_id);
    return;
  end if;

  update public.leader_otp_challenges
  set attempts = attempts + 1,
      expires_at = case when attempts + 1 >= 5 then now() else expires_at end
  where id = p_challenge_id;

  insert into public.ip_rate_limits (ip, scope, failed_attempts, updated_at)
  values (p_ip, 'leader_otp_verify', 1, now())
  on conflict (ip, scope) do update
    set failed_attempts = public.ip_rate_limits.failed_attempts + 1, updated_at = now()
  returning failed_attempts, lockout_count into v_ip_attempts, v_ip_lockout_count;

  if v_ip_attempts >= 5 then
    update public.ip_rate_limits
    set failed_attempts = 0,
        lockout_count = lockout_count + 1,
        locked_until = now() + public.next_lockout_duration(lockout_count)
    where ip = p_ip and scope = 'leader_otp_verify';
  end if;

  perform public.log_audit_event(v_person_id, 'leader_otp_failed', 'people', v_person_id);
end;
$$;

grant execute on function public.leader_otp_is_locked(uuid, inet) to authenticated;
grant execute on function public.leader_otp_verify_record(uuid, inet, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- leader_set_whatsapp_number — first-login setup (no admin-driven
-- onboarding flow exists yet — Task 14). A leader sets their own number
-- once; changing it later is the same call, not a separate "reset" path.
-- ---------------------------------------------------------------------------
create or replace function public.leader_set_whatsapp_number(p_whatsapp_number text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists (select 1 from public.leaders where person_id = public.current_uid()) then
    raise exception 'not a leader';
  end if;
  if p_whatsapp_number !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'whatsapp number must be E.164 format';
  end if;

  update public.leaders
  set whatsapp_number = p_whatsapp_number
  where person_id = public.current_uid();

  perform public.log_audit_event(public.current_uid(), 'leader_whatsapp_number_set', 'leaders', public.current_uid());
end;
$$;

grant execute on function public.leader_set_whatsapp_number(text) to authenticated;

-- A leader may read their own whatsapp_number (to show it back to them on
-- the setup screen) — everything else about `leaders` was already readable
-- via existing policies; this is the one column that needed its own path
-- since it's new and otherwise only touched through the function above.
create or replace function public.leader_get_own_whatsapp_number()
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select whatsapp_number from public.leaders where person_id = public.current_uid()
$$;

grant execute on function public.leader_get_own_whatsapp_number() to authenticated;
