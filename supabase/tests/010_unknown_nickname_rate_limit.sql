-- An enumeration attempt against an unknown nickname must still count on
-- the per-IP axis, even with no person_id to record against.
begin;
select plan(2);

\ir support/auth_fixtures.sql

-- No matching scout for this nickname in Unit C.
select is_empty(
  $$ select * from public.find_scout_for_login('c0000000-0000-0000-0000-000000000001', 'nobody-here') $$,
  'an unknown nickname resolves to no candidate'
);

select public.scout_login_record(null, '10.0.0.9'::inet, false) from generate_series(1, 5);

select ok(
  (select locked_until > now() from public.ip_rate_limits
   where ip = '10.0.0.9'::inet and scope = 'scout_pin_login'),
  '5 failed attempts against unknown nicknames from the same IP still locks that IP'
);

select * from finish();
rollback;
