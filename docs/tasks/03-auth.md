# Task 03 — Auth: scout PIN, leader TOTP, rate limiting

## Scope

Two distinct auth paths that never mix.

**Scouts**: join code + nickname + 6-digit PIN. No email addresses for minors.
**Leaders and admin**: email + password + mandatory TOTP.

## Architecture

- Scout credentials are custom: a `scout_credentials` table holding
  `person_id`, `pin_hash` (argon2id), `failed_attempts`, `locked_until`.
  Verification happens in a server action, never client-side.
- On success, mint a Supabase session for that person via a server-side call.
  The scout client never sees a service-role key.
- Leaders use Supabase Auth directly with TOTP enrolment enforced before any
  leader route is reachable.
- Join codes: per unit, per season, in a `join_codes` table with `expires_at`.
  Enrollment closes by expiring the code, not by deleting it.

## Rules

- **Rate limiting is server-side.** 5 failures → 15 minute lock, escalating on
  repeat. Track per `person_id` and per IP independently.
- PIN reset is a leader action only. No self-service reset, no security question.
- A leader must never be able to authenticate through the scout path, and a
  scout session must never satisfy a leader route guard.
- Device binding is deliberately **not** in this task — Wave 3.
- Every failed authorisation attempt writes an `audit_log` row.
- Access token short-lived, refresh rotation with reuse detection.

## Test cases

- [ ] correct join code + nickname + PIN issues a scout session
- [ ] wrong PIN increments `failed_attempts`
- [ ] 5th failure sets `locked_until`; 6th attempt with the _correct_ PIN is refused
- [ ] lock expires and login succeeds after the window
- [ ] rate limit applies per IP even across different accounts
- [ ] expired join code is refused
- [ ] a leader's email cannot be used on the scout login path
- [ ] a scout session hitting a leader route gets 403, not a redirect loop
- [ ] leader without TOTP enrolled cannot reach any leader route
- [ ] PIN hashes are argon2id and never logged
- [ ] failed attempts appear in `audit_log`
- [ ] E2E: full scout login on a mobile viewport

## Done when

All tests pass, and a brute-force script against a known nickname is
demonstrably locked out within 5 attempts.
