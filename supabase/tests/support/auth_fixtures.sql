-- Shared fixtures for the Task 03 auth pgTAP suite. Included via `\ir` from
-- each test file inside its own transaction — nothing here commits.

insert into public.units (id, name_en, name_ar, grade_low, grade_high) values
  ('c0000000-0000-0000-0000-000000000001', 'Unit C', 'الوحدة ج', 5, 6),
  ('d0000000-0000-0000-0000-000000000001', 'Unit D', 'الوحدة د', 7, 8);

insert into public.people (id, display_name) values
  ('c0000000-0000-0000-0000-000000000101', 'Camp Scout'),
  ('c0000000-0000-0000-0000-000000000102', 'Camp Scout'), -- deliberate duplicate nickname
  ('c0000000-0000-0000-0000-000000000103', 'Solo Scout'),
  ('c0000000-0000-0000-0000-000000000201', 'Leader C'),
  ('d0000000-0000-0000-0000-000000000201', 'Leader D'),
  ('00000000-0000-0000-0000-000000000301', 'Admin One');

insert into public.leaders (person_id, role, unit_id) values
  ('c0000000-0000-0000-0000-000000000201', 'leader', 'c0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000201', 'leader', 'd0000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000301', 'admin', null);

insert into public.unit_enrollments (person_id, unit_id) values
  ('c0000000-0000-0000-0000-000000000101', 'c0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000102', 'c0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000103', 'c0000000-0000-0000-0000-000000000001');

insert into public.scout_credentials (person_id, pin_hash) values
  ('c0000000-0000-0000-0000-000000000101', 'hash-1'),
  ('c0000000-0000-0000-0000-000000000102', 'hash-2'),
  ('c0000000-0000-0000-0000-000000000103', 'hash-3');

insert into public.join_codes (unit_id, code, expires_at, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'CAMP2026C', now() + interval '30 days', 'c0000000-0000-0000-0000-000000000201'),
  ('c0000000-0000-0000-0000-000000000001', 'OLD2020C', now() - interval '30 days', 'c0000000-0000-0000-0000-000000000201');
