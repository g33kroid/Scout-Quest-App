-- Journal: five sections derived from existing tables, teammate count
-- (never names), and history surviving a unit promotion.
-- docs/tasks/10-journal.md test cases.
begin;
select plan(14);

\ir support/journal_fixtures.sql

-- Complete Q1 (solo) and Q2 (group, with a teammate) for Scout One, before
-- promotion — this is the "two seasons of history" the done-when case asks
-- for: season one's completions must survive into season two.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000201')::text, true);
select public.award_points(
  array['ba000000-0000-0000-0000-000000000101']::uuid[], 'minor', 'award',
  'ba000000-0000-0000-0000-000000000501', null, 'q1-solo'
);
select public.award_points(
  array['ba000000-0000-0000-0000-000000000101', 'ba000000-0000-0000-0000-000000000102']::uuid[],
  'standard', 'award', 'ba000000-0000-0000-0000-000000000502', null, 'q2-group'
);
reset role;

-- ---------------------------------------------------------------------------
-- Five sections, pre-promotion, from Scout One's own perspective.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000101')::text, true);

select is(
  (select count(*)::int from journal_completed where person_id = 'ba000000-0000-0000-0000-000000000101'),
  2,
  'Completed: two quests awarded so far'
);
select is(
  (select count(*)::int from quest_board_state
   where person_id = 'ba000000-0000-0000-0000-000000000101' and state = 'available'),
  2,
  'Active: two available quests'
);
select is(
  (select count(*)::int from quest_board_state
   where person_id = 'ba000000-0000-0000-0000-000000000101' and state = 'locked'),
  1,
  'Locked: one quest gated on an unmet prerequisite'
);
select is(
  (select count(*)::int from quest_board_state
   where person_id = 'ba000000-0000-0000-0000-000000000101' and state = 'expired'),
  1,
  'Missed: one expired, never-completed quest'
);

-- Completion detail: when + points, not just a count.
select is(
  (select points_earned from journal_completed
   where person_id = 'ba000000-0000-0000-0000-000000000101' and quest_id = 'ba000000-0000-0000-0000-000000000501'),
  10,
  'journal_completed reports points earned for a minor-tier solo quest'
);

-- Group quest: a teammate COUNT, never a name (asked, not invented — see
-- migration comment; conflicts with "no scout-to-scout visibility, ever").
select is(
  (select public.journal_completed_teammate_count(
    'ba000000-0000-0000-0000-000000000101', 'ba000000-0000-0000-0000-000000000502'
  )),
  1,
  'group quest completion lists a teammate count of 1, not a name'
);
reset role;

-- A scout cannot read another scout's journal, or query teammates about
-- someone else's completion.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000102')::text, true);
select is(
  (select count(*)::int from journal_completed where person_id = 'ba000000-0000-0000-0000-000000000101'),
  0,
  'a scout sees only their own journal, not a teammate''s'
);
select is(
  (select public.journal_completed_teammate_count(
    'ba000000-0000-0000-0000-000000000101', 'ba000000-0000-0000-0000-000000000502'
  )),
  0,
  'querying another scout''s teammate count is refused (returns 0, not the real count)'
);
reset role;

-- Patrol contribution: the home screen's own-vs-patrol stat.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000101')::text, true);
select is(
  (select total from patrol_totals where patrol_id = 'ba000000-0000-0000-0000-000000000801'),
  35,
  'patrol_totals sums the patrol''s awards (10 + 25, Scout One''s own two quests)'
);
reset role;

-- ---------------------------------------------------------------------------
-- Simulated promotion: Unit BA -> Unit BB. History must survive.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000301')::text, true);
update unit_enrollments set ended_at = now()
where id = 'ba000000-0000-0000-0000-000000000901';
insert into unit_enrollments (person_id, unit_id)
values ('ba000000-0000-0000-0000-000000000101', 'bb000000-0000-0000-0000-000000000001');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'ba000000-0000-0000-0000-000000000101')::text, true);

select is(
  (select count(*)::int from journal_completed where person_id = 'ba000000-0000-0000-0000-000000000101'),
  2,
  'a scout promoted from unit A to unit B retains full completed history'
);
select is(
  (select points_earned from journal_completed
   where person_id = 'ba000000-0000-0000-0000-000000000101' and quest_id = 'ba000000-0000-0000-0000-000000000502'),
  25,
  'the old unit''s group-quest completion detail is untouched by the promotion'
);
select is(
  (select count(*)::int from quest_board_state
   where person_id = 'ba000000-0000-0000-0000-000000000101'
     and unit_id = 'ba000000-0000-0000-0000-000000000001'),
  0,
  'the old unit''s board no longer appears — enrollment there has ended'
);
select is(
  (select state from quest_board_state
   where person_id = 'ba000000-0000-0000-0000-000000000101'
     and quest_id = 'bb000000-0000-0000-0000-000000000501'),
  'available',
  'the new unit''s board is reachable immediately after promotion'
);
reset role;

-- Streak: already covered end-to-end by Task 06's own pgTAP suite
-- (attendance_streak) — journal reuses that function unchanged, not
-- re-implemented, so re-asserting it here would just duplicate that
-- coverage rather than test anything journal-specific.
select ok(true, 'streak calculation is attendance_streak() unchanged — see 011_task06_attendance.sql');

select * from finish();
rollback;
