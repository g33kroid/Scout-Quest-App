-- Attendance, excused absences, and the pastoral disengagement signal.
-- docs/tasks/06-attendance.md test cases.
begin;
select plan(22);

\ir support/attendance_fixtures.sql

-- ---------------------------------------------------------------------------
-- Unit A6: the real scenario. Scout One triggers the two-unexplained-
-- no-show rule; Scout Two is the "six excused absences" done-when case.
-- 8 weekly sessions each (s1..s8 = ...0301..0308).
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a6000000-0000-0000-0000-000000000201')::text, true);

-- Scout One: present, present, [self excuse below], present, [no-show], [no-show], present, excused.
insert into attendance (person_id, session_id, status, recorded_by) values
  ('a6000000-0000-0000-0000-000000000101', 'a6000000-0000-0000-0000-000000000301', 'present', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000101', 'a6000000-0000-0000-0000-000000000302', 'present', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000101', 'a6000000-0000-0000-0000-000000000304', 'present', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000101', 'a6000000-0000-0000-0000-000000000307', 'present', 'a6000000-0000-0000-0000-000000000201');
insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a6000000-0000-0000-0000-000000000101', 'a6000000-0000-0000-0000-000000000308', 'excused', 'none_given', 'a6000000-0000-0000-0000-000000000201');

-- Scout Two: present twice, excused every other week after — six excuses,
-- zero unexplained no-shows.
insert into attendance (person_id, session_id, status, recorded_by) values
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000301', 'present', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000302', 'present', 'a6000000-0000-0000-0000-000000000201');
insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000303', 'excused', 'unwell', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000304', 'excused', 'exams', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000305', 'excused', 'travel', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000306', 'excused', 'transport', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000307', 'excused', 'other', 'a6000000-0000-0000-0000-000000000201'),
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000308', 'excused', 'none_given', 'a6000000-0000-0000-0000-000000000201');
reset role;

-- Scout One submits their own advance excuse for s3 — the "scout can
-- submit an excuse in advance" path, self only.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a6000000-0000-0000-0000-000000000101')::text, true);
insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a6000000-0000-0000-0000-000000000101', 'a6000000-0000-0000-0000-000000000303', 'excused', 'family', 'a6000000-0000-0000-0000-000000000101');
reset role;

-- ---------------------------------------------------------------------------
-- Unit A7: append-only mechanics, isolated so none of it shifts Unit A6's
-- rate numbers above.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-0000-0000-000000000301')::text, true);

insert into attendance (person_id, session_id, status, recorded_by) values
  ('a7000000-0000-0000-0000-000000000101', 'a7000000-0000-0000-0000-000000000301', 'present', 'a7000000-0000-0000-0000-000000000301'),
  ('a7000000-0000-0000-0000-000000000101', 'a7000000-0000-0000-0000-000000000302', 'absent', 'a7000000-0000-0000-0000-000000000301');
insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a7000000-0000-0000-0000-000000000101', 'a7000000-0000-0000-0000-000000000303', 'excused', 'unwell', 'a7000000-0000-0000-0000-000000000301');

select is(
  (select count(*)::int from attendance where person_id = 'a7000000-0000-0000-0000-000000000101'),
  3,
  'marking present/absent/excused writes one row each, append-only'
);

-- Correction: a second row for the same (person, session), original untouched.
insert into attendance (person_id, session_id, status, recorded_by) values
  ('a7000000-0000-0000-0000-000000000101', 'a7000000-0000-0000-0000-000000000304', 'present', 'a7000000-0000-0000-0000-000000000301');
insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a7000000-0000-0000-0000-000000000101', 'a7000000-0000-0000-0000-000000000304', 'excused', 'family', 'a7000000-0000-0000-0000-000000000301');

select is(
  (select count(*)::int from attendance
   where person_id = 'a7000000-0000-0000-0000-000000000101' and session_id = 'a7000000-0000-0000-0000-000000000304'),
  2,
  'correcting a status writes a new row instead of replacing one'
);
select ok(
  (select exists (
    select 1 from attendance
    where person_id = 'a7000000-0000-0000-0000-000000000101'
      and session_id = 'a7000000-0000-0000-0000-000000000304'
      and status = 'present'
  )),
  'the original row survives a correction unchanged'
);

-- No UPDATE/DELETE path exists for anyone, staff or admin — corrections are
-- always a new INSERT.
select throws_ok(
  $$ update attendance set status = 'excused' where person_id = 'a7000000-0000-0000-0000-000000000101' and session_id = 'a7000000-0000-0000-0000-000000000301' $$,
  42501, null, 'direct UPDATE on attendance is refused, even for admin'
);
select throws_ok(
  $$ delete from attendance where person_id = 'a7000000-0000-0000-0000-000000000101' and session_id = 'a7000000-0000-0000-0000-000000000301' $$,
  42501, null, 'direct DELETE on attendance is refused, even for admin'
);

-- An excused row must state a category — none_given exists precisely so
-- silence is never required, but it must be chosen explicitly.
select throws_ok(
  $$ insert into attendance (person_id, session_id, status, recorded_by)
     values ('a7000000-0000-0000-0000-000000000102', 'a7000000-0000-0000-0000-000000000301', 'excused', 'a7000000-0000-0000-0000-000000000301') $$,
  23514, null, 'an excused row with no category at all is refused'
);

insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a7000000-0000-0000-0000-000000000102', 'a7000000-0000-0000-0000-000000000302', 'excused', 'none_given', 'a7000000-0000-0000-0000-000000000301');
select ok(
  (select exists (
    select 1 from attendance
    where person_id = 'a7000000-0000-0000-0000-000000000102' and excuse_category = 'none_given'
  )),
  'none_given is selectable and behaves like any other category'
);
reset role;

-- Self-excuse: a scout may submit their own advance excuse and nothing else.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-0000-0000-000000000101')::text, true);
insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a7000000-0000-0000-0000-000000000101', 'a7000000-0000-0000-0000-000000000305', 'excused', 'unwell', 'a7000000-0000-0000-0000-000000000101');
select is(
  (select count(*)::int from attendance
   where person_id = 'a7000000-0000-0000-0000-000000000101' and session_id = 'a7000000-0000-0000-0000-000000000305'),
  1,
  'a scout can submit their own advance excuse'
);
select throws_ok(
  $$ insert into attendance (person_id, session_id, status, excuse_category, recorded_by)
     values ('a7000000-0000-0000-0000-000000000102', 'a7000000-0000-0000-0000-000000000305', 'excused', 'unwell', 'a7000000-0000-0000-0000-000000000101') $$,
  42501, null, 'a scout cannot submit an excuse for someone else'
);
reset role;

-- ---------------------------------------------------------------------------
-- Streak: an excused absence freezes it, an unexplained absence resets it.
-- Two isolated 3-session scouts, otherwise identical.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-0000-0000-000000000301')::text, true);
insert into attendance (person_id, session_id, status, recorded_by) values
  ('a7000000-0000-0000-0000-000000000105', 'a8000000-0000-0000-0000-000000000401', 'present', 'a7000000-0000-0000-0000-000000000301');
insert into attendance (person_id, session_id, status, excuse_category, recorded_by) values
  ('a7000000-0000-0000-0000-000000000105', 'a8000000-0000-0000-0000-000000000402', 'excused', 'unwell', 'a7000000-0000-0000-0000-000000000301');
insert into attendance (person_id, session_id, status, recorded_by) values
  ('a7000000-0000-0000-0000-000000000105', 'a8000000-0000-0000-0000-000000000403', 'present', 'a7000000-0000-0000-0000-000000000301'),
  -- Reset scout: session 402 is left unrecorded, defaulting to absent.
  ('a7000000-0000-0000-0000-000000000106', 'a8000000-0000-0000-0000-000000000401', 'present', 'a7000000-0000-0000-0000-000000000301'),
  ('a7000000-0000-0000-0000-000000000106', 'a8000000-0000-0000-0000-000000000403', 'present', 'a7000000-0000-0000-0000-000000000301');
reset role;

select is(
  (select public.attendance_streak('a7000000-0000-0000-0000-000000000105')),
  2,
  'an excused absence freezes the streak: present, excused, present = 2'
);
select is(
  (select public.attendance_streak('a7000000-0000-0000-0000-000000000106')),
  1,
  'an unexplained (defaulted) absence resets the streak: present, absent, present = 1'
);

-- ---------------------------------------------------------------------------
-- Rates and the pastoral signal, as admin (real RLS-gated read, not a
-- superuser bypass).
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-0000-0000-000000000301')::text, true);

select is(
  (select needs_attention from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000101'),
  true,
  'two unexplained no-shows surface the scout on the leader dashboard'
);
select is(
  (select unexplained_absence_count from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000101'),
  2,
  'Scout One has exactly two unexplained no-shows'
);
select is(
  (select unexplained_absence_count from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000102'),
  0,
  'excused absences do not increment the no-show counter, even six of them'
);
select is(
  (select needs_attention from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000102'),
  true,
  'a scout excused six times running still needs attention — the pastoral signal ignores the excuse'
);
select is(
  (select raw_rate from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000101'),
  0.5000,
  'Scout One raw attendance rate is 4/8'
);
select is(
  (select excused_adjusted_rate from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000101'),
  0.6667,
  'Scout One excused-adjusted rate excludes the excused session from the denominator'
);
select isnt(
  (select raw_rate from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000101'),
  (select excused_adjusted_rate from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000101'),
  'raw and excused-adjusted rates differ correctly on seeded data'
);
select is(
  (select raw_rate from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000102'),
  0.2500,
  'Scout Two raw attendance rate is 2/8'
);
select is(
  (select excused_adjusted_rate from attendance_rates where person_id = 'a6000000-0000-0000-0000-000000000102'),
  1.0000,
  'Scout Two excused-adjusted rate is a perfect 2/2 once the six excused sessions are excluded'
);
reset role;

-- No code path deducts points for an absence — nothing anywhere ever
-- inserts a ledger row for it.
select is(
  (select count(*)::int from ledger where reason = 'attendance'),
  0,
  'no code path writes an attendance-driven ledger entry'
);

-- ---------------------------------------------------------------------------
-- Isolation: a scout can read their own attendance and nobody else's.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a6000000-0000-0000-0000-000000000101')::text, true);
select is(
  (select count(*)::int from attendance where person_id = 'a6000000-0000-0000-0000-000000000102'),
  0,
  'a scout cannot read another scout''s attendance'
);
reset role;

select * from finish();
rollback;
