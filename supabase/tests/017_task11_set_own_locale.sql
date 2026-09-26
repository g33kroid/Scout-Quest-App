-- set_own_locale(): the only write path onto people.locale (Task 11) — no
-- general self-update RLS policy exists on people, so this is the narrow
-- SECURITY DEFINER exception, same shape as award_points()/
-- patrol_total_for_scout(). docs/tasks/11-bilingual.md: "locale preference
-- persists across devices for the same scout."
begin;
select plan(4);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000101')::text, true);

select public.set_own_locale('ar');

select is(
  (select locale::text from people where id = 'a0000000-0000-0000-0000-000000000101'),
  'ar',
  'set_own_locale updates the caller''s own locale'
);

select is(
  (select locale::text from people where id = 'a0000000-0000-0000-0000-000000000102'),
  'en',
  'another person''s locale is untouched — the function has no person_id parameter, only self'
);

select throws_ok(
  $$ select public.set_own_locale('fr') $$,
  '22P02',
  null,
  'an unsupported locale is rejected at the enum type boundary'
);
reset role;

-- Only a signed-in caller may reach this at all — no grant to anon.
set local role anon;
select throws_ok(
  $$ select public.set_own_locale('ar') $$,
  '42501',
  null,
  'an anonymous caller is refused outright, not silently ignored'
);
reset role;

select * from finish();
rollback;
