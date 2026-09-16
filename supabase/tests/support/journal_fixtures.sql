-- Shared fixtures for the Task 10 journal pgTAP suite.
--
-- Unit BA: Scout One's original unit — two completed quests (one solo, one
-- group with a teammate), one available, one locked, one expired/missed.
-- Unit BB: where Scout One gets promoted to mid-suite, with its own quest.

insert into public.units (id, name_en, name_ar, grade_low, grade_high) values
  ('ba000000-0000-0000-0000-000000000001', 'Unit BA', 'الوحدة ب أ', 5, 6),
  ('bb000000-0000-0000-0000-000000000001', 'Unit BB', 'الوحدة ب ب', 7, 8);

insert into public.people (id, display_name) values
  ('ba000000-0000-0000-0000-000000000201', 'Leader BA'),
  ('bb000000-0000-0000-0000-000000000201', 'Leader BB'),
  ('00000000-0000-0000-0000-000000000301', 'Admin One'),
  ('ba000000-0000-0000-0000-000000000101', 'Scout One'),
  ('ba000000-0000-0000-0000-000000000102', 'Scout Teammate');

insert into public.leaders (person_id, role, unit_id) values
  ('ba000000-0000-0000-0000-000000000201', 'leader', 'ba000000-0000-0000-0000-000000000001'),
  ('bb000000-0000-0000-0000-000000000201', 'leader', 'bb000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000301', 'admin', null);

-- Scout One starts in Unit BA (season 1). Ends later in the test file to
-- simulate promotion.
insert into public.unit_enrollments (id, person_id, unit_id, started_at) values
  ('ba000000-0000-0000-0000-000000000901', 'ba000000-0000-0000-0000-000000000101', 'ba000000-0000-0000-0000-000000000001', now() - interval '6 months');
insert into public.unit_enrollments (person_id, unit_id) values
  ('ba000000-0000-0000-0000-000000000102', 'ba000000-0000-0000-0000-000000000001');

insert into public.patrols (id, unit_id, name_en, name_ar) values
  ('ba000000-0000-0000-0000-000000000801', 'ba000000-0000-0000-0000-000000000001', 'Patrol BA1', 'فصيلة ب أ 1');
insert into public.patrol_memberships (person_id, patrol_id) values
  ('ba000000-0000-0000-0000-000000000101', 'ba000000-0000-0000-0000-000000000801');

-- Unit BA quests: Q1 (solo, completed), Q2 (group, completed w/ teammate),
-- Q3 (available), Q5 (available, unmet prereq target), Q4 (locked, needs
-- Q5), Q6 (expired, never completed).
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('ba000000-0000-0000-0000-000000000501', 'ba000000-0000-0000-0000-000000000001', 'minor', 'solo', 'ba000000-0000-0000-0000-000000000201'),
  ('ba000000-0000-0000-0000-000000000502', 'ba000000-0000-0000-0000-000000000001', 'standard', 'group', 'ba000000-0000-0000-0000-000000000201'),
  ('ba000000-0000-0000-0000-000000000503', 'ba000000-0000-0000-0000-000000000001', 'minor', 'solo', 'ba000000-0000-0000-0000-000000000201'),
  ('ba000000-0000-0000-0000-000000000504', 'ba000000-0000-0000-0000-000000000001', 'minor', 'solo', 'ba000000-0000-0000-0000-000000000201'),
  ('ba000000-0000-0000-0000-000000000505', 'ba000000-0000-0000-0000-000000000001', 'minor', 'solo', 'ba000000-0000-0000-0000-000000000201'),
  -- 506: expired below, never completed.
  ('ba000000-0000-0000-0000-000000000506', 'ba000000-0000-0000-0000-000000000001', 'minor', 'solo', 'ba000000-0000-0000-0000-000000000201');

insert into public.quest_translations (quest_id, locale, title, description)
select id, locale, 'Quest ' || right(id::text, 4), 'Description.'
from public.quests, unnest(array['en', 'ar']::public.locale_code[]) as locale
where unit_id = 'ba000000-0000-0000-0000-000000000001';

update public.quests set published_at = now()
where unit_id = 'ba000000-0000-0000-0000-000000000001'
  and id <> 'ba000000-0000-0000-0000-000000000506';
update public.quests set published_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where id = 'ba000000-0000-0000-0000-000000000506';

-- Q4 (503) requires Q5 (505), which Scout One has not completed — locked.
insert into public.quest_prereqs (quest_id, requires_quest_id) values
  ('ba000000-0000-0000-0000-000000000503', 'ba000000-0000-0000-0000-000000000505');

-- Unit BB's quest, for after the promotion.
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('bb000000-0000-0000-0000-000000000501', 'bb000000-0000-0000-0000-000000000001', 'minor', 'solo', 'bb000000-0000-0000-0000-000000000201');
insert into public.quest_translations (quest_id, locale, title, description) values
  ('bb000000-0000-0000-0000-000000000501', 'en', 'Unit BB Quest', 'A quest in the new unit.'),
  ('bb000000-0000-0000-0000-000000000501', 'ar', 'مهمة الوحدة ب ب', 'مهمة في الوحدة الجديدة.');
update public.quests set published_at = now() where id = 'bb000000-0000-0000-0000-000000000501';
