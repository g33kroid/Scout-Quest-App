-- set_own_avatar_config(): the only write path onto people.avatar_config
-- (Task 12) — no general self-update RLS policy exists on people, so this is
-- the narrow SECURITY DEFINER exception, same shape as set_own_locale().
-- docs/tasks/12-avatar.md: "a scout cannot modify another scout's
-- avatar_config".
begin;
select plan(6);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000101')::text, true);

select public.set_own_avatar_config('{"sex":"man","bgColor":"#ff0000"}'::jsonb);

select is(
  (select avatar_config->>'bgColor' from people where id = 'a0000000-0000-0000-0000-000000000101'),
  '#ff0000',
  'set_own_avatar_config updates the caller''s own avatar_config'
);

select is(
  (select avatar_config from people where id = 'a0000000-0000-0000-0000-000000000102'),
  '{}'::jsonb,
  'another person''s avatar_config is untouched — the function has no person_id parameter, only self'
);

-- A non-object config (scalar/array) is rejected by the jsonb_typeof guard:
-- the row is left exactly as it was.
select public.set_own_avatar_config('"not-an-object"'::jsonb);
select is(
  (select avatar_config->>'bgColor' from people where id = 'a0000000-0000-0000-0000-000000000101'),
  '#ff0000',
  'a non-object config is a no-op — the jsonb_typeof guard matches no row'
);

select public.set_own_avatar_config('[1,2,3]'::jsonb);
select is(
  (select avatar_config->>'bgColor' from people where id = 'a0000000-0000-0000-0000-000000000101'),
  '#ff0000',
  'an array config is likewise a no-op'
);

-- No session: anon's default EXECUTE is not revoked (same pattern as every
-- SECURITY DEFINER function here); the boundary is current_uid() being null,
-- so the UPDATE matches no row. Claim is transaction-local, clear it.
set local role anon;
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $$ select public.set_own_avatar_config('{"bgColor":"#000000"}'::jsonb) $$,
  'calling with no session does not error'
);
select is(
  (select avatar_config->>'bgColor' from people where id = 'a0000000-0000-0000-0000-000000000101'),
  '#ff0000',
  'and touches nobody''s row — still the authenticated caller''s earlier value'
);
reset role;

select * from finish();
rollback;
