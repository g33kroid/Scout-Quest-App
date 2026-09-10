-- Shared fixtures for the Task 04 ledger pgTAP suite.

insert into public.units (id, name_en, name_ar, grade_low, grade_high) values
  ('e0000000-0000-0000-0000-000000000001', 'Unit E', 'الوحدة هـ', 5, 6),
  ('f0000000-0000-0000-0000-000000000001', 'Unit F', 'الوحدة و', 7, 8);

-- 12 scouts in Unit E, for the group-award test cases.
insert into public.people (id, display_name)
select ('e0000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'Scout E' || n
from generate_series(1, 12) n;

insert into public.unit_enrollments (person_id, unit_id)
select ('e0000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid,
       'e0000000-0000-0000-0000-000000000001'
from generate_series(1, 12) n;

insert into public.people (id, display_name) values
  ('f0000000-0000-0000-0000-000000000101', 'Scout F1'),
  ('e0000000-0000-0000-0000-000000000201', 'Leader E'),
  ('f0000000-0000-0000-0000-000000000201', 'Leader F'),
  ('00000000-0000-0000-0000-000000000301', 'Admin One');

insert into public.unit_enrollments (person_id, unit_id) values
  ('f0000000-0000-0000-0000-000000000101', 'f0000000-0000-0000-0000-000000000001');

insert into public.leaders (person_id, role, unit_id) values
  ('e0000000-0000-0000-0000-000000000201', 'leader', 'e0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000201', 'leader', 'f0000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000301', 'admin', null);

-- Published quest in Unit E.
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('e0000000-0000-0000-0000-000000000501', 'e0000000-0000-0000-0000-000000000001', 'standard', 'solo', 'e0000000-0000-0000-0000-000000000201');
insert into public.quest_translations (quest_id, locale, title, description) values
  ('e0000000-0000-0000-0000-000000000501', 'en', 'Camp cooking', 'Cook a full meal at camp.'),
  ('e0000000-0000-0000-0000-000000000501', 'ar', 'الطبخ في المخيم', 'اطبخ وجبة كاملة في المخيم.');
update public.quests set published_at = now() where id = 'e0000000-0000-0000-0000-000000000501';

-- Unpublished quest, same unit.
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('e0000000-0000-0000-0000-000000000502', 'e0000000-0000-0000-0000-000000000001', 'minor', 'solo', 'e0000000-0000-0000-0000-000000000201');
