-- Leader WhatsApp OTP: the second factor that replaced authenticator-app
-- TOTP (a post-Task-03 decision — see the PR/migration comments for why).
begin;
select plan(13);

\ir support/auth_fixtures.sql

-- ---------------------------------------------------------------------------
-- Setting and reading a WhatsApp number: self only.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000201')::text, true);

select throws_ok(
  $$ select public.leader_set_whatsapp_number('0501234567') $$,
  null, null, 'a non-E.164 number is rejected'
);
select lives_ok(
  $$ select public.leader_set_whatsapp_number('+15550100003') $$,
  'a valid E.164 number is accepted'
);
select is(
  (select public.leader_get_own_whatsapp_number()),
  '+15550100003',
  'a leader can read back their own number'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-000000000201')::text, true);
select is(
  (select public.leader_get_own_whatsapp_number()),
  null,
  'a different leader who never set a number gets null, not leader C''s'
);
reset role;

-- ---------------------------------------------------------------------------
-- Challenge lifecycle.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000201')::text, true);

select throws_ok(
  $$ select public.leader_generate_otp_challenge('d0000000-0000-0000-0000-000000000201', 'hash-x') $$,
  null, null, 'a leader cannot generate an OTP challenge for someone else'
);

select public.leader_generate_otp_challenge('c0000000-0000-0000-0000-000000000201', 'hash-first');
select is(
  (select code_hash from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  'hash-first',
  'the active challenge is the one just generated'
);

-- A second challenge supersedes the first — the old code stops working.
select public.leader_generate_otp_challenge('c0000000-0000-0000-0000-000000000201', 'hash-second');
select is(
  (select code_hash from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  'hash-second',
  'generating a new challenge supersedes the previous one'
);
select is(
  (select count(*)::int from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  1,
  'only one active challenge exists at a time, never a growing pile'
);
reset role;

-- ---------------------------------------------------------------------------
-- Verify record: success consumes the challenge; failure increments
-- attempts and (after 5) expires that challenge outright.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000201')::text, true);

select public.leader_otp_verify_record(
  (select id from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  '10.0.0.1'::inet,
  true
);
select is(
  (select count(*)::int from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  0,
  'a successfully verified challenge is consumed — no longer active'
);

select public.leader_generate_otp_challenge('c0000000-0000-0000-0000-000000000201', 'hash-third');
select ok(
  (select id from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')) is not null,
  'a fresh challenge after a successful verify is active again'
);

-- Five wrong guesses kill this specific challenge.
select public.leader_otp_verify_record(
  (select id from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  '10.0.0.2'::inet, false
);
select public.leader_otp_verify_record(
  (select id from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  '10.0.0.2'::inet, false
);
select public.leader_otp_verify_record(
  (select id from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  '10.0.0.2'::inet, false
);
select public.leader_otp_verify_record(
  (select id from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  '10.0.0.2'::inet, false
);
select public.leader_otp_verify_record(
  (select id from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  '10.0.0.2'::inet, false
);
select is(
  (select count(*)::int from public.leader_get_active_otp_challenge('c0000000-0000-0000-0000-000000000201')),
  0,
  'five wrong guesses expires the challenge outright — a fresh one must be requested'
);

-- And the IP itself is now locked (5th failure crosses the IP threshold too).
select ok(
  (select public.leader_otp_is_locked('c0000000-0000-0000-0000-000000000201', '10.0.0.2'::inet)),
  'the IP is locked out after 5 failed OTP attempts, same as every other login surface'
);
reset role;

-- Nobody reads the raw table directly — same boundary as scout_credentials.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000201')::text, true);
select throws_ok(
  $$ select count(*) from leader_otp_challenges $$,
  42501, null, 'nobody reads leader_otp_challenges directly, not even its own owner'
);
reset role;

select * from finish();
rollback;
