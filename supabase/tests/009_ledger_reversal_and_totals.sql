-- reverse_ledger_entry() and person_totals. docs/tasks/04-ledger.md test cases.
begin;
select plan(7);

\ir support/ledger_fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000201')::text, true);

select id into temp orig from public.award_points(
  array['e0000000-0000-0000-0000-000000000101']::uuid[], 'major', 'award', null, null, 'to-reverse'
);

select public.reverse_ledger_entry((select id from orig), 'mistaken award');

select is(
  (select delta from ledger where id = (select id from orig)),
  50,
  'reverse_ledger_entry leaves the original row''s delta untouched'
);
select is(
  (select reason from ledger where id = (select id from orig)),
  'award'::ledger_reason,
  'reverse_ledger_entry leaves the original row''s reason untouched'
);
select is(
  (select count(*)::int from ledger where person_id = 'e0000000-0000-0000-0000-000000000101' and reason = 'correction'),
  1,
  'reversal writes exactly one new compensating row'
);
select is(
  (select delta from ledger where person_id = 'e0000000-0000-0000-0000-000000000101' and reason = 'correction'),
  -50,
  'the compensating row is the negative of the original'
);

-- Reversing again is idempotent, not a double reversal.
select public.reverse_ledger_entry((select id from orig), 'again');
select is(
  (select count(*)::int from ledger where person_id = 'e0000000-0000-0000-0000-000000000101' and reason = 'correction'),
  1,
  'reversing the same entry twice does not double-reverse it'
);

-- person_totals matches a hand-computed sum after a mixed award/reversal.
select public.award_points(
  array['e0000000-0000-0000-0000-000000000101']::uuid[], 'minor', 'award', null, null, 'extra-award'
);
reset role;

select is(
  (select total from person_totals where person_id = 'e0000000-0000-0000-0000-000000000101'),
  (select sum(delta)::int from ledger where person_id = 'e0000000-0000-0000-0000-000000000101'),
  'person_totals matches a hand-computed SUM after a mixed award/reversal'
);
select is(
  (select total from person_totals where person_id = 'e0000000-0000-0000-0000-000000000101'),
  10, -- 50 (major) - 50 (reversal) + 10 (minor) = 10
  'the mixed award/reversal total is the expected concrete number'
);

select * from finish();
rollback;
