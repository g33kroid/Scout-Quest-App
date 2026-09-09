-- Admin and anon RLS boundaries. docs/tasks/02-schema-rls.md pgTAP checklist.
begin;
select plan(6);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000301')::text, true);
-- now acting as Admin One

select results_eq(
  $$ select unit_id from people p
     join unit_enrollments ue on ue.person_id = p.id
     where p.id in ('a0000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000101')
     order by unit_id $$,
  $$ values
      ('a0000000-0000-0000-0000-000000000001'::uuid),
      ('b0000000-0000-0000-0000-000000000001'::uuid) $$,
  'admin can read people across units'
);

select results_eq(
  $$ select person_id from parent_contacts order by person_id $$,
  $$ values
      ('a0000000-0000-0000-0000-000000000101'::uuid),
      ('b0000000-0000-0000-0000-000000000101'::uuid) $$,
  'admin can read parent_contacts across units'
);

reset role;
set local role anon;
-- anon carries no JWT at all — clear the admin claims set above, or
-- current_uid() would still resolve to the admin's id for this role too.
select set_config('request.jwt.claims', '', true);

select is_empty(
  $$ select 1 from people $$,
  'anon can read no people rows (RLS-filtered to empty)'
);

select throws_ok(
  $$ select 1 from ledger $$,
  42501,
  null,
  'anon has no grant on ledger at all'
);

select throws_ok(
  $$ select 1 from leaders $$,
  42501,
  null,
  'anon has no grant on leaders at all'
);

select throws_ok(
  $$ select 1 from parent_contacts $$,
  42501,
  null,
  'anon has no grant on parent_contacts at all'
);

select * from finish();
rollback;
