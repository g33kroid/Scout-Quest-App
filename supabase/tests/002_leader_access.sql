-- Leader RLS boundaries. docs/tasks/02-schema-rls.md pgTAP checklist.
begin;
select plan(7);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000201')::text, true);
-- now acting as Leader A (unit A)

select is_empty(
  $$ select 1 from people where id = 'b0000000-0000-0000-0000-000000000101' $$,
  'leader cannot select scouts outside their unit'
);

select isnt_empty(
  $$ select 1 from people where id = 'a0000000-0000-0000-0000-000000000101' $$,
  'leader can select scouts inside their unit'
);

select is_empty(
  $$ select 1 from parent_contacts where person_id = 'b0000000-0000-0000-0000-000000000101' $$,
  'leader cannot select parent_contacts outside their unit'
);

select isnt_empty(
  $$ select 1 from parent_contacts where person_id = 'a0000000-0000-0000-0000-000000000101' $$,
  'leader can select parent_contacts inside their unit'
);

select throws_ok(
  $$ insert into ledger (person_id, delta, reason, awarded_by, idempotency_key)
     values ('a0000000-0000-0000-0000-000000000101', 10, 'award', 'a0000000-0000-0000-0000-000000000201', 'leader-direct-insert-attempt') $$,
  42501,
  null,
  'leader cannot insert into ledger directly'
);

-- Switch to Leader B (unit B) and try to edit Unit A's quest.
select set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-0000-0000-000000000201')::text, true);
update quests set tier = 'epic' where id = 'a0000000-0000-0000-0000-000000000501';
reset role;

select is(
  (select tier::text from quests where id = 'a0000000-0000-0000-0000-000000000501'),
  'minor',
  'leader cannot update another unit''s quest'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000201')::text, true);
update quests set tier = 'major' where id = 'a0000000-0000-0000-0000-000000000501';
reset role;

select is(
  (select tier::text from quests where id = 'a0000000-0000-0000-0000-000000000501'),
  'major',
  'leader can update their own unit''s quest'
);

select * from finish();
rollback;
