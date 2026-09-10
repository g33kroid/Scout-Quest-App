-- leader_reset_scout_pin authorization + scout_credentials/join_codes RLS.
-- docs/tasks/03-auth.md: "PIN reset is a leader action only."
begin;
select plan(10);

\ir support/auth_fixtures.sql

-- Same-unit leader can reset; clears lockout state too.
update public.scout_credentials
set failed_attempts = 3, lockout_count = 2, locked_until = now() + interval '1 hour'
where person_id = 'c0000000-0000-0000-0000-000000000101';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000201')::text, true);
select public.leader_reset_scout_pin('c0000000-0000-0000-0000-000000000101', 'new-hash-1');
reset role;

select is(
  (select pin_hash from public.scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101'),
  'new-hash-1',
  'a same-unit leader can reset a scout''s PIN'
);
select ok(
  (select failed_attempts = 0 and lockout_count = 0 and locked_until is null
   from public.scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101'),
  'a PIN reset also clears lockout state'
);

-- A different unit's leader is refused.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-000000000201')::text, true);
select throws_ok(
  $$ select public.leader_reset_scout_pin('c0000000-0000-0000-0000-000000000102', 'hacked') $$,
  null,
  null,
  'a leader from a different unit cannot reset this scout''s PIN'
);
reset role;

select is(
  (select pin_hash from public.scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000102'),
  'hash-2',
  'the cross-unit reset attempt did not change anything'
);

-- A non-leader, non-admin caller is refused outright (the NULL-safety fix).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000103')::text, true);
select throws_ok(
  $$ select public.leader_reset_scout_pin('c0000000-0000-0000-0000-000000000101', 'hacked') $$,
  null,
  null,
  'a scout (not a leader at all) cannot reset any PIN'
);
reset role;

-- scout_credentials: nobody writes directly, even admin.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000301')::text, true);
select throws_ok(
  $$ update scout_credentials set pin_hash = 'direct-write' where person_id = 'c0000000-0000-0000-0000-000000000101' $$,
  42501,
  null,
  'admin cannot update scout_credentials directly, only via leader_reset_scout_pin'
);

-- scout_credentials SELECT: admin only, not even the scout's own leader.
select isnt_empty(
  $$ select 1 from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101' $$,
  'admin can read scout_credentials directly'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000201')::text, true);
select is_empty(
  $$ select 1 from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101' $$,
  'even the scout''s own leader cannot read scout_credentials directly'
);

-- join_codes: unit-scoped read/write, same pattern as quests.
select isnt_empty(
  $$ select 1 from join_codes where code = 'CAMP2026C' $$,
  'a leader can read their own unit''s join codes'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-000000000201')::text, true);
select is_empty(
  $$ select 1 from join_codes where code = 'CAMP2026C' $$,
  'a different unit''s leader cannot read this unit''s join codes'
);
reset role;

select * from finish();
rollback;
