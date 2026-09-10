-- Task 03 — auth schema. See docs/tasks/03-auth.md and docs/schema.md.
--
-- Two auth paths, two credential shapes, never mixed:
-- - Scouts: join code + nickname + 6-digit PIN, fully custom (this file).
--   No row here is an `auth.users` row directly — GoTrue's `auth.users` still
--   exists per scout (created at enrollment, Task 14), but the PIN itself is
--   never GoTrue's concern. Verification and rate-limiting live entirely in
--   our own tables + SECURITY DEFINER functions.
-- - Leaders/admin: Supabase Auth directly (email + password + mandatory
--   TOTP) — GoTrue owns those credentials entirely. Nothing new to store
--   here beyond what `leaders` (Task 02) already has; the auth.users row IS
--   the credential store.
--
-- Rate limiting tracks per-person and per-IP *independently* (docs/spec.md),
-- so this needs two tables, not one.

-- ---------------------------------------------------------------------------
-- scout_credentials — 1:1 with people for scouts only. PIN is argon2id,
-- hashed and verified in the app layer (Node) — Postgres has no argon2id
-- primitive. This table only ever stores the hash and the lockout state.
-- ---------------------------------------------------------------------------
create table public.scout_credentials (
  person_id uuid primary key references public.people (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  -- Escalating lockout: each time a lock triggers, lockout_count increments
  -- and the next lock is longer (app-layer computes the duration; see
  -- lib/server/rate-limit.ts). Reset to 0 after a long quiet period.
  lockout_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- join_codes — per unit, per season (nullable: D2 is unresolved, see
-- docs/schema.md). Enrollment closes by expiring the code, never deleting
-- it — the row is the audit trail of every code that ever existed.
-- ---------------------------------------------------------------------------
create table public.join_codes (
  id uuid primary key default public.uuid_generate_v7(),
  unit_id uuid not null references public.units (id) on delete cascade,
  season_id uuid references public.seasons (id) on delete set null,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.people (id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- ip_rate_limits — the per-IP half of "track per person_id and per IP
-- independently." One row per (ip, scope); scope keeps scout-login and
-- leader-login attempts from sharing a counter, since they're different
-- attack surfaces with different lockout meaning.
-- ---------------------------------------------------------------------------
create type public.rate_limit_scope as enum ('scout_pin_login', 'leader_login');

create table public.ip_rate_limits (
  ip inet not null,
  scope public.rate_limit_scope not null,
  failed_attempts int not null default 0,
  lockout_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (ip, scope)
);

create index on public.join_codes (unit_id);
create index on public.scout_credentials (locked_until) where locked_until is not null;
create index on public.ip_rate_limits (locked_until) where locked_until is not null;
