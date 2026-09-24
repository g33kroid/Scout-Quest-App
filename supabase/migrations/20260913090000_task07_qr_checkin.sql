-- Task 07 — QR check-in credentials. See docs/tasks/07-qr-checkin.md.
--
-- No new attendance write path: a validated scan is authorized the same way
-- a manual roster tap is (Task 06) — "manual override records identically
-- to a scan" is true by construction, not a rule to separately enforce.
-- This migration only adds what the offline HMAC verification itself needs:
-- a per-scout secret, and the two narrow reads that deliver it (once to the
-- scout's own device, and to a leader's device for their whole roster).
--
-- qr_opaque_id is a random hex string, not a uuid — the payload must never
-- contain the real person_id, and giving the opaque id a visually distinct
-- shape makes that easy to verify by inspection, not just by convention.

alter table public.scout_credentials
  add column qr_opaque_id text not null unique default encode(gen_random_bytes(16), 'hex'),
  add column qr_secret bytea not null default gen_random_bytes(32);

-- ---------------------------------------------------------------------------
-- get_own_qr_credential — a scout's device calls this once (docs: "delivered
-- once to their device") and caches the result; never re-fetched routinely.
-- ---------------------------------------------------------------------------
create or replace function public.get_own_qr_credential()
returns table (qr_opaque_id text, qr_secret bytea)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select sc.qr_opaque_id, sc.qr_secret
  from public.scout_credentials sc
  where sc.person_id = public.current_uid()
$$;

grant execute on function public.get_own_qr_credential() to authenticated;

-- ---------------------------------------------------------------------------
-- get_unit_qr_roster — a leader's device calls this once per session (while
-- online) and caches the bundle, so scanning itself never needs a network
-- round trip. Unauthorized units return zero rows rather than raising —
-- same shape as every other RLS-scoped read in this codebase, and exactly
-- what makes "a token for a scout outside the leader's unit is rejected"
-- true: that scout's secret was simply never in the cache to begin with.
-- ---------------------------------------------------------------------------
create or replace function public.get_unit_qr_roster(p_unit_id uuid)
returns table (person_id uuid, qr_opaque_id text, qr_secret bytea)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select p.id, sc.qr_opaque_id, sc.qr_secret
  from public.people p
  join public.unit_enrollments ue on ue.person_id = p.id
  join public.scout_credentials sc on sc.person_id = p.id
  where ue.unit_id = p_unit_id
    and (ue.ended_at is null or ue.ended_at > now())
    and public.is_admin_or_leader_of(p_unit_id)
$$;

grant execute on function public.get_unit_qr_roster(uuid) to authenticated;
