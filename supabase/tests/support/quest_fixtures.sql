-- Shared fixtures for the Task 09 quest board pgTAP suite.
--
-- Unit Q9: the real chain-of-3 scenario (Scout One, Leader Q).
-- Unit R9: exists only to be "another unit" for the cross-unit RLS cases.

insert into public.units (id, name_en, name_ar, grade_low, grade_high) values
  ('b9000000-0000-0000-0000-000000000001', 'Unit Q9', 'الوحدة ق9', 5, 6),
  ('d9000000-0000-0000-0000-000000000001', 'Unit R9', 'الوحدة ر9', 5, 6);

insert into public.people (id, display_name) values
  ('b9000000-0000-0000-0000-000000000201', 'Leader Q'),
  ('d9000000-0000-0000-0000-000000000201', 'Leader R'),
  ('00000000-0000-0000-0000-000000000301', 'Admin One'),
  ('b9000000-0000-0000-0000-000000000101', 'Scout One'),
  ('d9000000-0000-0000-0000-000000000101', 'Scout Other Unit');

insert into public.leaders (person_id, role, unit_id) values
  ('b9000000-0000-0000-0000-000000000201', 'leader', 'b9000000-0000-0000-0000-000000000001'),
  ('d9000000-0000-0000-0000-000000000201', 'leader', 'd9000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000301', 'admin', null);

insert into public.unit_enrollments (person_id, unit_id) values
  ('b9000000-0000-0000-0000-000000000101', 'b9000000-0000-0000-0000-000000000001'),
  ('d9000000-0000-0000-0000-000000000101', 'd9000000-0000-0000-0000-000000000001');

-- A chain of 3: Q1 <- Q2 <- Q3 (Q2 requires Q1, Q3 requires Q2).
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('b9000000-0000-0000-0000-000000000501', 'b9000000-0000-0000-0000-000000000001', 'minor', 'solo', 'b9000000-0000-0000-0000-000000000201'),
  ('b9000000-0000-0000-0000-000000000502', 'b9000000-0000-0000-0000-000000000001', 'minor', 'solo', 'b9000000-0000-0000-0000-000000000201'),
  ('b9000000-0000-0000-0000-000000000503', 'b9000000-0000-0000-0000-000000000001', 'minor', 'solo', 'b9000000-0000-0000-0000-000000000201');

insert into public.quest_translations (quest_id, locale, title, description) values
  ('b9000000-0000-0000-0000-000000000501', 'en', 'Quest One', 'First in the chain.'),
  ('b9000000-0000-0000-0000-000000000501', 'ar', 'المهمة الأولى', 'الأولى في السلسلة.'),
  ('b9000000-0000-0000-0000-000000000502', 'en', 'Quest Two', 'Second in the chain.'),
  ('b9000000-0000-0000-0000-000000000502', 'ar', 'المهمة الثانية', 'الثانية في السلسلة.'),
  ('b9000000-0000-0000-0000-000000000503', 'en', 'Quest Three', 'Third in the chain.'),
  ('b9000000-0000-0000-0000-000000000503', 'ar', 'المهمة الثالثة', 'الثالثة في السلسلة.');

update public.quests set published_at = now()
where id in (
  'b9000000-0000-0000-0000-000000000501',
  'b9000000-0000-0000-0000-000000000502',
  'b9000000-0000-0000-0000-000000000503'
);

insert into public.quest_prereqs (quest_id, requires_quest_id) values
  ('b9000000-0000-0000-0000-000000000502', 'b9000000-0000-0000-0000-000000000501'),
  ('b9000000-0000-0000-0000-000000000503', 'b9000000-0000-0000-0000-000000000502');

-- An already-expired, published, no-prereq quest.
insert into public.quests (id, unit_id, tier, kind, created_by, expires_at) values
  ('b9000000-0000-0000-0000-000000000504', 'b9000000-0000-0000-0000-000000000001', 'minor', 'solo', 'b9000000-0000-0000-0000-000000000201', now() - interval '1 day');
insert into public.quest_translations (quest_id, locale, title, description) values
  ('b9000000-0000-0000-0000-000000000504', 'en', 'Expired Quest', 'Already past its window.'),
  ('b9000000-0000-0000-0000-000000000504', 'ar', 'مهمة منتهية', 'انتهت نافذتها بالفعل.');
update public.quests set published_at = now() - interval '2 days'
where id = 'b9000000-0000-0000-0000-000000000504';

-- Never published — for "scout cannot query an unpublished quest" cases.
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('b9000000-0000-0000-0000-000000000505', 'b9000000-0000-0000-0000-000000000001', 'minor', 'solo', 'b9000000-0000-0000-0000-000000000201');
