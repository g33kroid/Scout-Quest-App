-- award_points() and the "nobody writes ledger directly" boundary.
-- docs/tasks/04-ledger.md test cases.
begin;
select plan(11);

\ir support/ledger_fixtures.sql

-- Nobody writes ledger directly, leader or admin.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000201')::text, true);
select throws_ok(
  $$ insert into ledger (person_id, delta, reason, awarded_by, idempotency_key)
     values ('e0000000-0000-0000-0000-000000000101', 10, 'award', 'e0000000-0000-0000-0000-000000000201', 'direct-1') $$,
  42501, null, 'direct INSERT into ledger as leader is refused'
);
select throws_ok(
  $$ update ledger set delta = 999 $$,
  42501, null, 'direct UPDATE on ledger is refused for a leader'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000301')::text, true);
select throws_ok(
  $$ delete from ledger $$,
  42501, null, 'direct DELETE on ledger is refused even for admin'
);
reset role;

-- award_points: 12 person_ids in one call, atomically.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000201')::text, true);

select is(
  (select count(*)::int from public.award_points(
    (select array_agg(id) from public.people where display_name like 'Scout E%'),
    'standard', 'award', null, null, 'batch-1'
  )),
  12,
  'award_points with 12 person_ids writes exactly 12 rows'
);

-- Idempotent replay: same key, still 12 total in the table, not 24.
select public.award_points(
  (select array_agg(id) from public.people where display_name like 'Scout E%'),
  'standard', 'award', null, null, 'batch-1'
);
reset role;

select is(
  (select count(*)::int from ledger where idempotency_key like 'batch-1:%'),
  12,
  'a replayed idempotency_key writes 12 rows total, not 24'
);

-- Tier -> points is a fixed server-side mapping, never a client number —
-- there's no parameter through which a raw number could even be passed.
select is(
  (select delta from ledger where person_id = 'e0000000-0000-0000-0000-000000000101'::uuid and idempotency_key = 'batch-1:e0000000-0000-0000-0000-000000000101'),
  25,
  '''standard'' tier always maps to 25, regardless of anything the caller sends'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000201')::text, true);

-- Leader awarding outside their unit is refused.
select throws_ok(
  $$ select public.award_points(array['f0000000-0000-0000-0000-000000000101']::uuid[], 'minor', 'award', null, null, 'cross-unit') $$,
  null, null, 'leader awarding to a scout outside their unit is refused'
);

-- Awarding against an unpublished quest is refused.
select throws_ok(
  $$ select public.award_points(array['e0000000-0000-0000-0000-000000000101'::uuid], 'minor', 'award',
       'e0000000-0000-0000-0000-000000000502', null, 'unpub-quest') $$,
  null, null, 'awarding against an unpublished quest is refused'
);

-- One invalid person_id in an array of 12 rolls back all 12.
select throws_ok(
  $$ select public.award_points(
       (select array_agg(id) from public.people where display_name like 'Scout E%')
         || array['00000000-0000-0000-0000-000000000999']::uuid[],
       'minor', 'award', null, null, 'rollback-test'
     ) $$,
  null, null, 'an invalid person_id anywhere in the array raises'
);
reset role;

select is(
  (select count(*)::int from ledger where idempotency_key like 'rollback-test%'),
  0,
  'the invalid-person_id call rolled back all 12 rows, not just the bad one'
);

select is(
  (select count(*)::int from audit_log where action = 'ledger_award'),
  2,
  'every successful award writes an audit_log row (2 successful calls above)'
);

select * from finish();
rollback;
