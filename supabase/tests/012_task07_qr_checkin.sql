-- QR check-in credential distribution. docs/tasks/07-qr-checkin.md test
-- cases that are DB/RLS-shaped (the rest — token rotation, clock skew,
-- tamper detection — are covered as pure-function unit tests in
-- lib/qr-token.test.ts; camera/hardware cases need a real device, tracked
-- in the PR).
begin;
select plan(11);

\ir support/auth_fixtures.sql

-- Unit D gets a scout too, so "outside the leader's unit" has someone to be
-- outside of.
insert into public.people (id, display_name) values
  ('d0000000-0000-0000-0000-000000000101', 'Other Unit Scout');
insert into public.unit_enrollments (person_id, unit_id) values
  ('d0000000-0000-0000-0000-000000000101', 'd0000000-0000-0000-0000-000000000001');
insert into public.scout_credentials (person_id, pin_hash) values
  ('d0000000-0000-0000-0000-000000000101', 'hash-d1');

-- Every scout_credentials row gets a qr_opaque_id/qr_secret automatically
-- (column defaults) — no separate seeding needed.

select is(
  (select octet_length(qr_secret) from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101'),
  32,
  'qr_secret defaults to a 32-byte random key'
);
select ok(
  (select qr_opaque_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101'),
  'qr_opaque_id is not shaped like a UUID — never confusable with the real person_id'
);

-- Captured before the role switch below (superuser bypasses RLS here) —
-- the scout's own function call is later compared against this, since
-- re-querying the raw table under the scout's own restricted role would
-- just return nothing (proven by the very next assertion).
select qr_opaque_id as expected_own_opaque_id
from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101' \gset

-- A scout cannot bypass get_own_qr_credential() and read the raw table —
-- the function is the only sanctioned path, same as PIN hashes.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000101')::text, true);
select is(
  (select count(*)::int from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101'),
  0,
  'a scout cannot read their own scout_credentials row directly'
);

-- get_own_qr_credential(): a scout gets exactly their own credential.
select is(
  (select count(*)::int from get_own_qr_credential()),
  1,
  'get_own_qr_credential returns exactly one row for the calling scout'
);
select is(
  (select qr_opaque_id from get_own_qr_credential()),
  :'expected_own_opaque_id',
  'get_own_qr_credential returns this scout''s own opaque id, not anyone else''s'
);
reset role;

-- get_unit_qr_roster(): a leader gets their whole roster's credentials.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000201')::text, true);
select is(
  (select count(*)::int from get_unit_qr_roster('c0000000-0000-0000-0000-000000000001')),
  3,
  'a leader''s roster bundle has one credential per actively enrolled scout'
);
select is(
  (select count(*)::int from get_unit_qr_roster('c0000000-0000-0000-0000-000000000001')
   where person_id = 'd0000000-0000-0000-0000-000000000101'),
  0,
  'a scout outside the leader''s unit is not in the cached roster bundle'
);

-- The actual rejection docs/tasks/07-qr-checkin.md means: calling the
-- other unit's roster function directly returns nothing either.
select is(
  (select count(*)::int from get_unit_qr_roster('d0000000-0000-0000-0000-000000000001')),
  0,
  'a leader cannot fetch a roster bundle for a unit they do not lead'
);
reset role;

-- Admin can fetch any unit's bundle.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000301')::text, true);
select is(
  (select count(*)::int from get_unit_qr_roster('c0000000-0000-0000-0000-000000000001')),
  3,
  'an admin can fetch any unit''s roster bundle'
);
reset role;

-- Every credential is unique per scout — two scouts never collide.
select isnt(
  (select qr_opaque_id from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101'),
  (select qr_opaque_id from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000102'),
  'two scouts never share an opaque id'
);
select isnt(
  (select qr_secret from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000101'),
  (select qr_secret from scout_credentials where person_id = 'c0000000-0000-0000-0000-000000000102'),
  'two scouts never share a signing secret'
);

select * from finish();
rollback;
