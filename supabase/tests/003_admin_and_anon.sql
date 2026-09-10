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

-- NOTE: real Supabase pre-grants broad table privileges to anon/authenticated
-- (ALTER DEFAULT PRIVILEGES at cluster bootstrap) and relies on RLS alone —
-- docs/spec.md: "RLS is the only real boundary... grants are convenience,
-- never security." So these must assert zero rows, not a grant-level error:
-- a bare-Postgres setup (this project's own role provisioning) might also
-- deny at the grant level, but that's not guaranteed and isn't the real
-- target's behavior. Confirmed against the actual `supabase start` stack.
select is_empty(
  $$ select 1 from ledger $$,
  'anon can read no ledger rows'
);

select is_empty(
  $$ select 1 from leaders $$,
  'anon can read no leaders rows'
);

select is_empty(
  $$ select 1 from parent_contacts $$,
  'anon can read no parent_contacts rows'
);

select * from finish();
rollback;
