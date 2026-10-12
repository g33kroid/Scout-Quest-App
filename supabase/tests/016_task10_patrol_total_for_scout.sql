-- patrol_total_for_scout(): the real cross-member sum patrol_totals can't
-- give a scout querying it themselves (RLS on ledger hides teammates' rows
-- from security_invoker views). docs/tasks/10-journal.md's home screen
-- "own vs patrol" stat needs the actual patrol total.
begin;
select plan(4);

\ir support/journal_fixtures.sql

-- journal_fixtures.sql only puts Scout One in patrol BA1 — add Scout
-- Teammate too, so this scenario actually has two contributing members to
-- sum (the bug this function fixes only shows up with more than one).
insert into public.patrol_memberships (person_id, patrol_id) values
  ('ba000000-0000-0000-0000-000000000102', 'ba000000-0000-0000-0000-000000000801');

-- Both Scout One (10 + 25) and Scout Teammate (25, the shared group award)
-- contribute to patrol BA1 — the real total is 60, not the 35 that querying
-- patrol_totals directly as Scout One returns (that view sums only what
-- Scout One's own RLS lets them see: their own rows).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000201')::text, true);
select public.award_points(
  array['ba000000-0000-0000-0000-000000000101']::uuid[], 'minor', 'award',
  'ba000000-0000-0000-0000-000000000501', null, 'patrol-total-q1'
);
select public.award_points(
  array['ba000000-0000-0000-0000-000000000101', 'ba000000-0000-0000-0000-000000000102']::uuid[],
  'standard', 'award', 'ba000000-0000-0000-0000-000000000502', null, 'patrol-total-q2'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000101')::text, true);
select is(
  (select public.patrol_total_for_scout('ba000000-0000-0000-0000-000000000801')),
  60,
  'a patrol member sees the real cross-member total, not just their own rows'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000102')::text, true);
select is(
  (select public.patrol_total_for_scout('ba000000-0000-0000-0000-000000000801')),
  60,
  'any current member of the patrol sees the same total'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000201')::text, true);
select is(
  (select public.patrol_total_for_scout('ba000000-0000-0000-0000-000000000801')),
  60,
  'the patrol''s own unit leader sees the same total'
);
reset role;

-- Leader BB is a leader, but of a different unit entirely — not this
-- patrol's own leader, not a member, and not admin.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'bb000000-0000-0000-0000-000000000201')::text, true);
select is(
  (select public.patrol_total_for_scout('ba000000-0000-0000-0000-000000000801')),
  0,
  'a leader of a different unit is refused (returns 0, not the real total)'
);
reset role;

select * from finish();
rollback;
