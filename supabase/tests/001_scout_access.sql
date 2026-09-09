-- Scout RLS boundaries. docs/tasks/02-schema-rls.md pgTAP checklist.
begin;
select plan(11);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000101')::text, true);
-- now acting as Scout A1 (unit A, patrol Falcons)

select is_empty(
  $$ select 1 from people where id = 'b0000000-0000-0000-0000-000000000101' $$,
  'scout cannot select another unit''s people row'
);

select isnt_empty(
  $$ select 1 from people where id = 'a0000000-0000-0000-0000-000000000101' $$,
  'scout can select their own people row'
);

select isnt_empty(
  $$ select 1 from people where id = 'a0000000-0000-0000-0000-000000000102' $$,
  'scout can select a patrol-mate''s people row'
);

select is_empty(
  $$ select 1 from parent_contacts where person_id = 'a0000000-0000-0000-0000-000000000101' $$,
  'scout cannot select any parent_contacts row, including their own parent'
);

select is_empty(
  $$ select 1 from parent_contacts where person_id = 'b0000000-0000-0000-0000-000000000101' $$,
  'scout cannot select another unit''s parent_contacts row'
);

select is_empty(
  $$ select 1 from audit_log $$,
  'scout cannot select audit_log'
);

select is_empty(
  $$ select 1 from quests where id = 'a0000000-0000-0000-0000-000000000502' $$,
  'scout cannot select an unpublished quest in their own unit'
);

select is_empty(
  $$ select 1 from quests where id = 'b0000000-0000-0000-0000-000000000501' $$,
  'scout cannot select a published quest from another unit'
);

select isnt_empty(
  $$ select 1 from quests where id = 'a0000000-0000-0000-0000-000000000501' $$,
  'scout can select a published quest in their own unit'
);

select results_eq(
  $$ select person_id from ledger order by person_id $$,
  $$ values ('a0000000-0000-0000-0000-000000000101'::uuid) $$,
  'scout can select only their own ledger rows'
);

select is_empty(
  $$ select 1 from ledger where person_id = 'b0000000-0000-0000-0000-000000000101' $$,
  'scout cannot select another person''s ledger rows'
);

select * from finish();
rollback;
