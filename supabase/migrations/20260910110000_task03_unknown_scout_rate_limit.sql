-- Fix: scout_login_record() required a person_id, so an attempt against an
-- unknown/ambiguous nickname (find_scout_for_login returns nothing) could
-- never be recorded on the per-IP axis at all — an enumeration attempt
-- against made-up nicknames bypassed rate limiting entirely. p_person_id is
-- now nullable; the person-side bookkeeping is simply skipped when null,
-- the IP-side still applies. Found while wiring the app-layer login flow
-- (lib/server/scout-auth.ts), not by the pgTAP suite — flagged in
-- docs/schema.md.
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
    if p_person_id is not null then
      update public.scout_credentials
      set failed_attempts = 0, locked_until = null, updated_at = now()
      where person_id = p_person_id;
    end if;

    update public.ip_rate_limits
    set failed_attempts = 0, locked_until = null, updated_at = now()
    where ip = p_ip and scope = 'scout_pin_login';

    perform public.log_audit_event(p_person_id, 'scout_login_success', 'people', p_person_id);
    return;
  end if;

  if p_person_id is not null then
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

  perform public.log_audit_event(
    p_person_id,
    case when p_person_id is null then 'scout_login_failed_unknown_nickname' else 'scout_login_failed' end,
    'people',
    p_person_id
  );
end;
$$;

-- is_locked already accepted a person_id and only checked the person-side
-- table when a row exists for it — exists() against a NULL person_id
-- correctly returns false, so no change needed there. This grant is just a
-- defensive re-assert in case the function signature ever gets dropped and
-- recreated by a future migration.
grant execute on function public.scout_login_is_locked(uuid, inet) to anon, authenticated;
