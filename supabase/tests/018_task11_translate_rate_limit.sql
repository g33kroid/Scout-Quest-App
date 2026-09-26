-- try_consume_translate_quota(): 20 calls/hour/leader, no direct table
-- access. docs/tasks/11-bilingual.md's translate-authoring flow;
-- .env.example documents LLM_API_KEY as "rate-limited per leader."
begin;
select plan(6);

\ir support/fixtures.sql

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000201')::text, true);

select is(
  (select public.try_consume_translate_quota()),
  true,
  'the first call in the window is allowed'
);

select is(
  (select count(*)::int from public.translation_calls where person_id = 'a0000000-0000-0000-0000-000000000201'),
  1,
  'an allowed call is recorded'
);

-- Consume the rest of the 20-per-hour budget (1 already spent above).
select public.try_consume_translate_quota() from generate_series(1, 19);

select is(
  (select count(*)::int from public.translation_calls where person_id = 'a0000000-0000-0000-0000-000000000201'),
  20,
  'quota fills at exactly 20 calls'
);

select is(
  (select public.try_consume_translate_quota()),
  false,
  'the 21st call within the hour is refused'
);

select is(
  (select count(*)::int from public.translation_calls where person_id = 'a0000000-0000-0000-0000-000000000201'),
  20,
  'a refused call is not itself recorded — the count does not creep past quota'
);

select throws_ok(
  $$ select * from public.translation_calls $$,
  '42501',
  null,
  'no direct read access — the function above is the only door'
);
reset role;

select * from finish();
rollback;
