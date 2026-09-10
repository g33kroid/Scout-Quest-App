-- Wave 1 schema. See docs/tasks/02-schema-rls.md and docs/schema.md.
--
-- Design notes that aren't obvious from the DDL alone:
-- - uuidv7 primary keys everywhere (opaque + time-ordered) via a hand-rolled
--   generator below — Postgres 15 has no native uuidv7(), and we don't want a
--   compiled extension dependency on top of the pgtap one we already need.
-- - `seasons` is NOT in docs/tasks/02-schema-rls.md's table list, but
--   `patrols.season_id` references one. D2 (season model / rollover) is an
--   open, unresolved decision (docs/open-decisions.md) — this table is only
--   enough to satisfy the FK, not a rollover implementation. Flagged in the PR.
-- - No `total_points` column anywhere, ever. Totals are always a SUM over
--   `ledger`. No exceptions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- uuidv7 (RFC 9562): 48-bit unix ms timestamp, version nibble, 12+62 random
-- bits, variant bits. Time-ordered so it's index-friendly, opaque so it's not
-- an enumeration invitation like a sequential integer would be.
-- ---------------------------------------------------------------------------
create or replace function public.uuid_generate_v7()
returns uuid
language plpgsql
volatile
as $$
declare
  ts_ms bytea := substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3 for 6);
  rand_part bytea := gen_random_bytes(10);
  uuid_bytes bytea := ts_ms || rand_part;
begin
  -- byte 6 high nibble = version 7, low nibble stays random
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- byte 8 high two bits = variant 10, low 6 bits stay random
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
  return encode(uuid_bytes, 'hex')::uuid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.locale_code as enum ('en', 'ar');
create type public.leader_role as enum ('admin', 'leader');
create type public.session_kind as enum ('class', 'camp_block');
create type public.quest_tier as enum ('minor', 'standard', 'major', 'epic');
create type public.quest_kind as enum ('solo', 'group');
create type public.ledger_reason as enum ('award', 'attendance', 'correction');
create type public.attendance_status as enum ('present', 'absent', 'excused');
create type public.excuse_category as enum (
  'unwell', 'exams', 'family', 'travel', 'transport', 'other'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.people (
  id uuid primary key default public.uuid_generate_v7(),
  display_name text not null check (char_length(display_name) between 1 and 60),
  locale public.locale_code not null default 'en',
  avatar_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  left_at timestamptz
);

-- Own table by design, own policy, own audit trail — never columns on people.
create table public.parent_contacts (
  id uuid primary key default public.uuid_generate_v7(),
  person_id uuid not null references public.people (id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text,
  email text,
  may_collect boolean not null default false,
  priority int not null default 1,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default public.uuid_generate_v7(),
  name_en text not null,
  name_ar text not null,
  grade_low int not null,
  grade_high int not null check (grade_high >= grade_low)
);

create table public.unit_enrollments (
  id uuid primary key default public.uuid_generate_v7(),
  person_id uuid not null references public.people (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);

-- D2 (season model) is unresolved — see file header. Minimal shape only.
create table public.seasons (
  id uuid primary key default public.uuid_generate_v7(),
  name text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);

create table public.patrols (
  id uuid primary key default public.uuid_generate_v7(),
  unit_id uuid not null references public.units (id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  season_id uuid references public.seasons (id) on delete set null
);

create table public.patrol_memberships (
  id uuid primary key default public.uuid_generate_v7(),
  person_id uuid not null references public.people (id) on delete cascade,
  patrol_id uuid not null references public.patrols (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);

-- 1:1 extension of people for the admin/leader identity. Absence of a row
-- here means "scout" — see current_leader_role() in the RLS migration.
create table public.leaders (
  person_id uuid primary key references public.people (id) on delete cascade,
  role public.leader_role not null,
  unit_id uuid references public.units (id) on delete restrict,
  check (role = 'admin' or unit_id is not null)
);

create table public.sessions (
  id uuid primary key default public.uuid_generate_v7(),
  unit_id uuid not null references public.units (id) on delete cascade,
  scheduled_at timestamptz not null,
  kind public.session_kind not null default 'class'
);

create table public.quests (
  id uuid primary key default public.uuid_generate_v7(),
  unit_id uuid not null references public.units (id) on delete cascade,
  tier public.quest_tier not null,
  kind public.quest_kind not null default 'solo',
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at is null or published_at is null or expires_at > published_at)
);

create table public.quest_translations (
  quest_id uuid not null references public.quests (id) on delete cascade,
  locale public.locale_code not null,
  title text not null,
  flavour text,
  description text not null,
  primary key (quest_id, locale)
);

-- Publishing requires both locales filled (non-negotiable rule 12). Enforced
-- here rather than app-layer-only, since a DB-level guarantee survives a bug
-- in any future write path.
create or replace function public.enforce_quest_publish_requires_both_locales()
returns trigger
language plpgsql
as $$
begin
  if new.published_at is not null then
    if (select count(distinct locale) from public.quest_translations where quest_id = new.id) < 2 then
      raise exception 'quest % cannot be published without both en and ar translations', new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger quests_publish_requires_both_locales
  before insert or update of published_at on public.quests
  for each row execute function public.enforce_quest_publish_requires_both_locales();

create table public.quest_prereqs (
  quest_id uuid not null references public.quests (id) on delete cascade,
  requires_quest_id uuid not null references public.quests (id) on delete cascade,
  primary key (quest_id, requires_quest_id),
  check (quest_id <> requires_quest_id)
);

-- Append-only. Never a total_points column — totals are always SUM(delta).
-- No direct writes: Task 04's SECURITY DEFINER functions are the only path.
create table public.ledger (
  id uuid primary key default public.uuid_generate_v7(),
  person_id uuid not null references public.people (id) on delete restrict,
  delta int not null,
  reason public.ledger_reason not null,
  quest_id uuid references public.quests (id) on delete restrict,
  session_id uuid references public.sessions (id) on delete restrict,
  awarded_by uuid not null references public.people (id) on delete restrict,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  -- Fixed point tiers (rule 2), hard-enforced at the DB level. Attendance
  -- entries carry no points of their own — see file header re: D6.
  check (
    (reason = 'attendance' and delta = 0)
    or (reason in ('award', 'correction') and abs(delta) in (10, 25, 50, 100))
  )
);

create table public.attendance (
  id uuid primary key default public.uuid_generate_v7(),
  person_id uuid not null references public.people (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  status public.attendance_status not null,
  excuse_category public.excuse_category,
  -- "short" per docs/spec.md excused-absence rules — no free-text medical detail.
  note text check (char_length(note) <= 280),
  recorded_by uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (person_id, session_id),
  check (status = 'excused' or excuse_category is null)
);

-- Append-only audit trail. Never updated, never deleted, not even by admin —
-- see the RLS migration for why that's a hard rule here specifically.
create table public.audit_log (
  id uuid primary key default public.uuid_generate_v7(),
  actor_id uuid references public.people (id) on delete set null,
  action text not null,
  subject_table text not null,
  subject_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for the access patterns RLS policies and app queries will use.
-- ---------------------------------------------------------------------------
create index on public.parent_contacts (person_id);
create index on public.unit_enrollments (person_id);
create index on public.unit_enrollments (unit_id);
create index on public.patrols (unit_id);
create index on public.patrol_memberships (person_id);
create index on public.patrol_memberships (patrol_id);
create index on public.leaders (unit_id);
create index on public.sessions (unit_id);
create index on public.quests (unit_id);
create index on public.quest_prereqs (requires_quest_id);
create index on public.ledger (person_id);
create index on public.ledger (quest_id);
create index on public.ledger (session_id);
create index on public.attendance (session_id);
create index on public.audit_log (subject_table, subject_id);
create index on public.audit_log (created_at);
