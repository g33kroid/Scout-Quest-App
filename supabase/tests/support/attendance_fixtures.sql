-- Shared fixtures for the Task 06 attendance pgTAP suite.
--
-- Unit A6: the real rate/streak/pastoral-signal scenario.
--   Scout1 — mixed record, triggers the two-unexplained-no-show rule.
--   Scout2 — six excused absences, zero unexplained: the "done when" case.
-- Unit A7: isolated from the above on purpose, so append-only/RLS mechanics
--   (correction, staff UPDATE/DELETE refusal, self-excuse-only) don't shift
--   Unit A6's hand-computed rate numbers.

insert into public.units (id, name_en, name_ar, grade_low, grade_high) values
  ('a6000000-0000-0000-0000-000000000001', 'Unit A6', 'الوحدة أ6', 5, 6),
  ('a7000000-0000-0000-0000-000000000001', 'Unit A7', 'الوحدة أ7', 5, 6),
  ('a8000000-0000-0000-0000-000000000001', 'Unit A8', 'الوحدة أ8', 5, 6);

insert into public.people (id, display_name) values
  ('a6000000-0000-0000-0000-000000000201', 'Leader A6'),
  ('a6000000-0000-0000-0000-000000000101', 'Scout A6 One'),
  ('a6000000-0000-0000-0000-000000000102', 'Scout A6 Two'),
  ('a7000000-0000-0000-0000-000000000301', 'Admin A7'),
  ('a7000000-0000-0000-0000-000000000101', 'Scout A7 Three'),
  ('a7000000-0000-0000-0000-000000000102', 'Scout A7 Other'),
  ('a7000000-0000-0000-0000-000000000105', 'Scout A7 Freeze'),
  ('a7000000-0000-0000-0000-000000000106', 'Scout A7 Reset');

insert into public.leaders (person_id, role, unit_id) values
  ('a6000000-0000-0000-0000-000000000201', 'leader', 'a6000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000301', 'admin', null);

insert into public.unit_enrollments (person_id, unit_id, started_at) values
  ('a6000000-0000-0000-0000-000000000101', 'a6000000-0000-0000-0000-000000000001', now() - interval '2 years'),
  ('a6000000-0000-0000-0000-000000000102', 'a6000000-0000-0000-0000-000000000001', now() - interval '2 years');

-- 8 weekly sessions, all in the past, oldest first.
insert into public.sessions (id, unit_id, scheduled_at)
select
  ('a6000000-0000-0000-0000-0000000003' || lpad(n::text, 2, '0'))::uuid,
  'a6000000-0000-0000-0000-000000000001',
  now() - (9 - n) * interval '1 week'
from generate_series(1, 8) n;

-- Unit A7's own sessions, used one-per-mechanical-test so none of them
-- touch Unit A6's rate math.
insert into public.sessions (id, unit_id, scheduled_at) values
  ('a7000000-0000-0000-0000-000000000301', 'a7000000-0000-0000-0000-000000000001', now() - interval '5 weeks'),
  ('a7000000-0000-0000-0000-000000000302', 'a7000000-0000-0000-0000-000000000001', now() - interval '4 weeks'),
  ('a7000000-0000-0000-0000-000000000303', 'a7000000-0000-0000-0000-000000000001', now() - interval '3 weeks'),
  ('a7000000-0000-0000-0000-000000000304', 'a7000000-0000-0000-0000-000000000001', now() - interval '2 weeks'),
  ('a7000000-0000-0000-0000-000000000305', 'a7000000-0000-0000-0000-000000000001', now() - interval '1 week');

-- Dedicated 3-session streak-freeze vs streak-reset comparison, in its own
-- unit so none of Unit A7's mechanical-test sessions bleed into it.
insert into public.unit_enrollments (person_id, unit_id, started_at) values
  ('a7000000-0000-0000-0000-000000000105', 'a8000000-0000-0000-0000-000000000001', now() - interval '10 weeks'),
  ('a7000000-0000-0000-0000-000000000106', 'a8000000-0000-0000-0000-000000000001', now() - interval '10 weeks');

insert into public.sessions (id, unit_id, scheduled_at) values
  ('a8000000-0000-0000-0000-000000000401', 'a8000000-0000-0000-0000-000000000001', now() - interval '3 weeks'),
  ('a8000000-0000-0000-0000-000000000402', 'a8000000-0000-0000-0000-000000000001', now() - interval '2 weeks'),
  ('a8000000-0000-0000-0000-000000000403', 'a8000000-0000-0000-0000-000000000001', now() - interval '1 week');
