-- A scout whose unit_enrollments.ended_at is in the past loses unit access.
-- docs/tasks/02-schema-rls.md pgTAP checklist.
begin;
select plan(4);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000103')::text, true);
-- Scout A Expired: enrollment in Unit A ended 10 days ago, nothing active.

select isnt_empty(
  $$ select 1 from people where id = 'a0000000-0000-0000-0000-000000000103' $$,
  'an expired-enrollment scout can still select their own people row'
);

select is_empty(
  $$ select 1 from units where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'an expired-enrollment scout loses access to the unit row'
);

select is_empty(
  $$ select 1 from quests where id = 'a0000000-0000-0000-0000-000000000501' $$,
  'an expired-enrollment scout loses access to the unit''s published quests'
);

select is_empty(
  $$ select 1 from sessions where id = 'a0000000-0000-0000-0000-000000000601' $$,
  'an expired-enrollment scout loses access to the unit''s sessions'
);

select * from finish();
rollback;
