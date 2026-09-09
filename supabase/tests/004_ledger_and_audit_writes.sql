-- ledger and audit_log: nobody writes directly, admin included.
-- docs/spec.md non-negotiable rule 1; docs/tasks/02-schema-rls.md RLS bullets.
begin;
select plan(6);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000301')::text, true);
-- acting as Admin One — even admin has no direct write path.

select throws_ok(
  $$ insert into ledger (person_id, delta, reason, awarded_by, idempotency_key)
     values ('a0000000-0000-0000-0000-000000000101', 25, 'award', '00000000-0000-0000-0000-000000000301', 'admin-direct-insert-attempt') $$,
  42501,
  null,
  'admin cannot insert into ledger directly'
);

select throws_ok(
  $$ update ledger set delta = 50 where person_id = 'a0000000-0000-0000-0000-000000000101' $$,
  42501,
  null,
  'admin cannot update a ledger row directly'
);

select throws_ok(
  $$ delete from ledger where person_id = 'a0000000-0000-0000-0000-000000000101' $$,
  42501,
  null,
  'admin cannot delete a ledger row directly'
);

select throws_ok(
  $$ insert into audit_log (actor_id, action, subject_table, subject_id)
     values ('00000000-0000-0000-0000-000000000301', 'manual_test', 'people', 'a0000000-0000-0000-0000-000000000101') $$,
  42501,
  null,
  'admin cannot insert into audit_log directly'
);

select throws_ok(
  $$ update audit_log set action = 'tampered' $$,
  42501,
  null,
  'admin cannot update audit_log directly'
);

select throws_ok(
  $$ delete from audit_log $$,
  42501,
  null,
  'admin cannot delete audit_log directly'
);

select * from finish();
rollback;
