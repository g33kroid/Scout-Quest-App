-- Shared fixture data for the Wave 1 RLS pgTAP suite. Included via `\ir` from
-- each test file inside its own transaction — nothing here commits.
-- Invented names/ids only, per docs/CLAUDE.md ("no real data in this repo").

insert into public.units (id, name_en, name_ar, grade_low, grade_high) values
  ('a0000000-0000-0000-0000-000000000001', 'Unit A', 'الوحدة أ', 5, 6),
  ('b0000000-0000-0000-0000-000000000001', 'Unit B', 'الوحدة ب', 7, 8);

insert into public.people (id, display_name, locale) values
  ('a0000000-0000-0000-0000-000000000101', 'Scout A1', 'en'),
  ('a0000000-0000-0000-0000-000000000102', 'Scout A2', 'en'),
  ('a0000000-0000-0000-0000-000000000103', 'Scout A Expired', 'en'),
  ('b0000000-0000-0000-0000-000000000101', 'Scout B1', 'en'),
  ('a0000000-0000-0000-0000-000000000201', 'Leader A', 'en'),
  ('b0000000-0000-0000-0000-000000000201', 'Leader B', 'en'),
  ('00000000-0000-0000-0000-000000000301', 'Admin One', 'en');

insert into public.leaders (person_id, role, unit_id) values
  ('a0000000-0000-0000-0000-000000000201', 'leader', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000201', 'leader', 'b0000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000301', 'admin', null);

insert into public.unit_enrollments (person_id, unit_id, started_at, ended_at) values
  ('a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', now() - interval '30 days', null),
  ('a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000001', now() - interval '30 days', null),
  ('b0000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000001', now() - interval '30 days', null),
  -- Expired: only a past enrollment, nothing active.
  ('a0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000001', now() - interval '60 days', now() - interval '10 days');

insert into public.patrols (id, unit_id, name_en, name_ar) values
  ('a0000000-0000-0000-0000-000000000401', 'a0000000-0000-0000-0000-000000000001', 'Falcons', 'الصقور');

insert into public.patrol_memberships (person_id, patrol_id, started_at, ended_at) values
  ('a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000401', now() - interval '30 days', null),
  ('a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000401', now() - interval '30 days', null);

insert into public.sessions (id, unit_id, scheduled_at, kind) values
  ('a0000000-0000-0000-0000-000000000601', 'a0000000-0000-0000-0000-000000000001', now(), 'class');

-- Published quest in unit A — insert unpublished first, add translations,
-- then publish (the both-locales-required trigger fires on this UPDATE).
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('a0000000-0000-0000-0000-000000000501', 'a0000000-0000-0000-0000-000000000001', 'minor', 'solo', 'a0000000-0000-0000-0000-000000000201');
insert into public.quest_translations (quest_id, locale, title, description) values
  ('a0000000-0000-0000-0000-000000000501', 'en', 'Tie a bowline', 'Learn the bowline knot.'),
  ('a0000000-0000-0000-0000-000000000501', 'ar', 'اربط عقدة البولين', 'تعلم عقدة البولين.');
update public.quests set published_at = now() where id = 'a0000000-0000-0000-0000-000000000501';

-- Unpublished quest, same unit.
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('a0000000-0000-0000-0000-000000000502', 'a0000000-0000-0000-0000-000000000001', 'standard', 'solo', 'a0000000-0000-0000-0000-000000000201');

-- Published quest in unit B, for cross-unit checks.
insert into public.quests (id, unit_id, tier, kind, created_by) values
  ('b0000000-0000-0000-0000-000000000501', 'b0000000-0000-0000-0000-000000000001', 'minor', 'solo', 'b0000000-0000-0000-0000-000000000201');
insert into public.quest_translations (quest_id, locale, title, description) values
  ('b0000000-0000-0000-0000-000000000501', 'en', 'Pitch a tent', 'Learn to pitch a two-person tent.'),
  ('b0000000-0000-0000-0000-000000000501', 'ar', 'انصب خيمة', 'تعلم نصب خيمة لشخصين.');
update public.quests set published_at = now() where id = 'b0000000-0000-0000-0000-000000000501';

insert into public.parent_contacts (person_id, name, relationship, phone, may_collect) values
  ('a0000000-0000-0000-0000-000000000101', 'Parent of Scout A1', 'parent', '+000000000', true),
  ('b0000000-0000-0000-0000-000000000101', 'Parent of Scout B1', 'parent', '+000000001', true);

insert into public.ledger (person_id, delta, reason, quest_id, awarded_by, idempotency_key) values
  ('a0000000-0000-0000-0000-000000000101', 10, 'award', 'a0000000-0000-0000-0000-000000000501', 'a0000000-0000-0000-0000-000000000201', 'fixture-award-scout-a1-1');

insert into public.audit_log (actor_id, action, subject_table, subject_id) values
  ('00000000-0000-0000-0000-000000000301', 'fixture_seed', 'people', 'a0000000-0000-0000-0000-000000000101');
