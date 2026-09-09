-- Scout login lookup + escalating lockout, per-person and per-IP.
-- docs/tasks/03-auth.md test cases.
begin;
select plan(11);

\ir support/auth_fixtures.sql

select is(
  public.verify_join_code('CAMP2026C'),
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'a live join code resolves to its unit'
);

select is(
  public.verify_join_code('OLD2020C'),
  null,
  'an expired join code is refused'
);

select is(
  (select person_id from public.find_scout_for_login('c0000000-0000-0000-0000-000000000001', 'solo scout')),
  'c0000000-0000-0000-0000-000000000103'::uuid,
  'find_scout_for_login matches case-insensitively'
);

select is_empty(
  $$ select * from public.find_scout_for_login('c0000000-0000-0000-0000-000000000001', 'Camp Scout') $$,
  'an ambiguous (duplicate) nickname fails closed rather than guessing'
);

select ok(
  not public.scout_login_is_locked('c0000000-0000-0000-0000-000000000103', '10.0.0.1'::inet),
  'a fresh account is not locked'
);

-- 5 failures locks both the person and the IP.
select public.scout_login_record('c0000000-0000-0000-0000-000000000103', '10.0.0.1'::inet, false)
  from generate_series(1, 5);

select ok(
  (select failed_attempts = 0 and lockout_count = 1 and locked_until > now()
   from public.scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000103'),
  '5th failure sets locked_until and resets the counter for next time'
);

select ok(
  public.scout_login_is_locked('c0000000-0000-0000-0000-000000000103', '10.0.0.1'::inet),
  '6th attempt (even with the correct PIN) is refused while locked'
);

-- Lock expiring in the past means no longer locked (both axes — the earlier
-- 5 failures locked the IP too, not just the person).
update public.scout_credentials set locked_until = now() - interval '1 minute'
  where person_id = 'c0000000-0000-0000-0000-000000000103';
update public.ip_rate_limits set locked_until = now() - interval '1 minute'
  where ip = '10.0.0.1'::inet and scope = 'scout_pin_login';
select ok(
  not public.scout_login_is_locked('c0000000-0000-0000-0000-000000000103', '10.0.0.1'::inet),
  'login succeeds again once the lock window has passed'
);

-- Rate limit applies per IP even across different accounts.
select public.scout_login_record('c0000000-0000-0000-0000-000000000101', '10.0.0.2'::inet, false)
  from generate_series(1, 4);
select public.scout_login_record('c0000000-0000-0000-0000-000000000102', '10.0.0.2'::inet, false);
select ok(
  (select locked_until > now() from public.ip_rate_limits
   where ip = '10.0.0.2'::inet and scope = 'scout_pin_login'),
  'the IP locks after 5 failures shared across two different accounts'
);
select ok(
  (select failed_attempts = 1 and locked_until is null
   from public.scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000102'),
  'the second account has only its own one failure, not locked by the other account''s failures'
);

-- Success resets state and is audited.
select public.scout_login_record('c0000000-0000-0000-0000-000000000101', '10.0.0.3'::inet, true);
select is(
  (select count(*)::int from public.audit_log where action = 'scout_login_success'),
  1,
  'a successful login is audited'
);

select * from finish();
rollback;
