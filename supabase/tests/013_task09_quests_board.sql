-- Quest prerequisites, cycle rejection, and the scout board's derived
-- state. docs/tasks/09-quests-board.md test cases.
begin;
select plan(15);

\ir support/quest_fixtures.sql

-- ---------------------------------------------------------------------------
-- Initial board state for Scout One: nothing completed yet.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b9000000-0000-0000-0000-000000000101')::text, true);

select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000501'),
  'available',
  'Quest One (no prereqs) starts available'
);
select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000502'),
  'locked',
  'Quest Two (requires Quest One) starts locked'
);
select is(
  (select unmet_prereq_ids from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000502'),
  array['b9000000-0000-0000-0000-000000000501']::uuid[],
  'Quest Two names its unmet prerequisite — locked quests are visible, not hidden'
);
select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000503'),
  'locked',
  'Quest Three (requires Quest Two) starts locked'
);
select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000504'),
  'expired',
  'an expired, never-completed quest shows expired/missed, not deleted'
);
select is(
  (select count(*)::int from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000505'),
  0,
  'scout cannot query an unpublished quest via the board view'
);
select is(
  (select count(*)::int from quests where id = 'b9000000-0000-0000-0000-000000000505'),
  0,
  'scout cannot query an unpublished quest directly either'
);
select is(
  (select count(*)::int from quests where unit_id = 'd9000000-0000-0000-0000-000000000001'),
  0,
  'scout cannot query another unit''s quests via the API directly'
);
reset role;

-- ---------------------------------------------------------------------------
-- The chain unlocks in sequence as Scout One completes each quest.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b9000000-0000-0000-0000-000000000201')::text, true);
select public.award_points(
  array['b9000000-0000-0000-0000-000000000101']::uuid[], 'minor', 'award',
  'b9000000-0000-0000-0000-000000000501', null, 'quest1-complete'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b9000000-0000-0000-0000-000000000101')::text, true);
select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000501'),
  'completed',
  'Quest One moves to completed once awarded'
);
select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000502'),
  'available',
  'Quest Two unlocks the moment its one prerequisite is completed'
);
select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000503'),
  'locked',
  'Quest Three stays locked — its own prerequisite (Quest Two) is not done yet'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b9000000-0000-0000-0000-000000000201')::text, true);
select public.award_points(
  array['b9000000-0000-0000-0000-000000000101']::uuid[], 'minor', 'award',
  'b9000000-0000-0000-0000-000000000502', null, 'quest2-complete'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b9000000-0000-0000-0000-000000000101')::text, true);
select is(
  (select state from quest_board_state where quest_id = 'b9000000-0000-0000-0000-000000000503'),
  'available',
  'the full chain of 3 unlocks in sequence: completing Quest Two unlocks Quest Three'
);
reset role;

-- ---------------------------------------------------------------------------
-- Cycle rejection and cross-unit authoring.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b9000000-0000-0000-0000-000000000201')::text, true);
select throws_ok(
  $$ insert into quest_prereqs (quest_id, requires_quest_id)
     values ('b9000000-0000-0000-0000-000000000501', 'b9000000-0000-0000-0000-000000000503') $$,
  null, null, 'a cyclic prerequisite chain is rejected on save'
);
select throws_ok(
  $$ insert into quests (unit_id, tier, kind, created_by)
     values ('d9000000-0000-0000-0000-000000000001', 'minor', 'solo', 'b9000000-0000-0000-0000-000000000201') $$,
  42501, null, 'a leader cannot publish (or author at all) into another unit'
);
reset role;

-- No `mandatory` column or flag anywhere in the schema.
select is(
  (select count(*)::int from information_schema.columns where column_name ilike '%mandatory%'),
  0,
  'no mandatory column or flag exists anywhere'
);

select * from finish();
rollback;
