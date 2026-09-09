-- Wave 1 RLS. See docs/tasks/02-schema-rls.md and docs/schema.md.
--
-- Design notes:
-- - We do NOT depend on Supabase's `auth` schema / `auth.uid()`. Scout auth
--   (join code + nickname + PIN) and mandatory leader TOTP are both custom
--   (Task 03), not GoTrue's stock email/password flow, so there's no
--   guarantee `auth.uid()` (or even the `auth` schema) exists in every
--   Postgres this runs against — including this project's own local dev,
--   which is plain Postgres with no Supabase services running at all. We
--   define our own `current_uid()` reading the same `request.jwt.claims`
--   GUC that PostgREST sets on every request regardless of who issued the
--   JWT, so this works unmodified against self-hosted Supabase in prod and
--   against bare Postgres + pgTAP locally/in CI.
-- - Role checks (admin/leader/scout) are derived from the `leaders` table on
--   every call, never trusted from a JWT claim. A demoted leader loses access
--   immediately, not at next token refresh.
-- - Grants are broad (SELECT/INSERT/UPDATE/DELETE to anon+authenticated on
--   every table) and RLS does all the real work — this matches how a real
--   self-hosted Supabase cluster actually bootstraps (`ALTER DEFAULT
--   PRIVILEGES ... GRANT ALL ... TO anon, authenticated`), confirmed against
--   `supabase start` locally. docs/spec.md is explicit that grants are
--   "convenience, never security" — so don't try to use narrower grants as a
--   second line of defense; RLS is the only line. `ledger` and `audit_log`
--   get an explicit REVOKE on top for their one true exception: nobody
--   writes directly, ever, not even admin.

-- ---------------------------------------------------------------------------
-- Roles. Supabase's self-hosted stack creates these at cluster bootstrap;
-- plain Postgres (local dev, and a vanilla postgres:* image) does not, so we
-- provision them ourselves, idempotently, rather than assume they exist.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Identity helpers. STABLE so the planner can cache within a statement.
-- SECURITY DEFINER + fixed search_path where a function must read a
-- caller-restricted table (leaders, unit_enrollments, patrol_memberships)
-- to answer a question about the caller's own identity only.
-- ---------------------------------------------------------------------------
create or replace function public.current_uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
$$;

create or replace function public.current_leader_role()
returns public.leader_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.leaders where person_id = public.current_uid()
$$;

create or replace function public.current_leader_unit_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select unit_id from public.leaders where person_id = public.current_uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_leader_role() = 'admin'
$$;

create or replace function public.is_leader_of_unit(target_unit uuid)
returns boolean
language sql
stable
as $$
  select public.current_leader_role() = 'leader'
    and public.current_leader_unit_id() = target_unit
$$;

create or replace function public.is_admin_or_leader_of(target_unit uuid)
returns boolean
language sql
stable
as $$
  select public.is_admin() or public.is_leader_of_unit(target_unit)
$$;

-- Active (non-expired) enrollment only — this is the function the "a scout
-- loses unit access once ended_at is in the past" pgTAP test exercises.
create or replace function public.is_enrolled_in_unit(target_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.unit_enrollments
    where person_id = public.current_uid()
      and unit_id = target_unit
      and (ended_at is null or ended_at > now())
  )
$$;

create or replace function public.shares_active_patrol(target_person uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.patrol_memberships mine
    join public.patrol_memberships theirs
      on theirs.patrol_id = mine.patrol_id
    where mine.person_id = public.current_uid()
      and theirs.person_id = target_person
      and (mine.ended_at is null or mine.ended_at > now())
      and (theirs.ended_at is null or theirs.ended_at > now())
  )
$$;

-- ---------------------------------------------------------------------------
-- people
-- ---------------------------------------------------------------------------
alter table public.people enable row level security;

create policy people_select on public.people for select
using (
  id = public.current_uid()
  or public.is_admin()
  or public.shares_active_patrol(id)
  or exists (
    select 1 from public.unit_enrollments ue
    where ue.person_id = people.id
      and (ue.ended_at is null or ue.ended_at > now())
      and public.is_leader_of_unit(ue.unit_id)
  )
);

create policy people_insert_admin on public.people for insert
with check (public.is_admin());

create policy people_update_admin on public.people for update
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- parent_contacts — no scout access, ever. Leader read is unit-scoped.
-- NOTE (open question, not resolved in this task): docs/spec.md requires "an
-- audit row written on every read". Postgres has no SELECT trigger, so a raw
-- table-grant + RLS policy (what's built here, and what the pgTAP suite
-- tests) cannot itself log reads. Real audit-on-read needs reads routed
-- through a SECURITY DEFINER function that logs then returns rows — building
-- that function is out of scope here (schema + RLS only) and should land
-- before Wave 1 ships. Flagging in docs/schema.md and the PR.
-- ---------------------------------------------------------------------------
alter table public.parent_contacts enable row level security;

create policy parent_contacts_select on public.parent_contacts for select
using (
  public.is_admin()
  or exists (
    select 1 from public.unit_enrollments ue
    where ue.person_id = parent_contacts.person_id
      and (ue.ended_at is null or ue.ended_at > now())
      and public.is_leader_of_unit(ue.unit_id)
  )
);

-- Deliberately admin-only write: docs/tasks/02-schema-rls.md grants leaders
-- READ on parent_contacts but doesn't mention write. Least-privilege default;
-- revisit if leaders are meant to maintain their own scouts' contacts.
create policy parent_contacts_write_admin on public.parent_contacts for all
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------
alter table public.units enable row level security;

create policy units_select on public.units for select
using (
  public.is_admin()
  or public.is_leader_of_unit(id)
  or public.is_enrolled_in_unit(id)
);

create policy units_write_admin on public.units for all
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- unit_enrollments
-- ---------------------------------------------------------------------------
alter table public.unit_enrollments enable row level security;

create policy unit_enrollments_select on public.unit_enrollments for select
using (
  person_id = public.current_uid()
  or public.is_admin()
  or public.is_leader_of_unit(unit_id)
);

create policy unit_enrollments_write_admin on public.unit_enrollments for all
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- seasons — not sensitive, readable by anyone signed in.
-- ---------------------------------------------------------------------------
alter table public.seasons enable row level security;

create policy seasons_select on public.seasons for select
using (true);

create policy seasons_write_admin on public.seasons for all
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- patrols
-- ---------------------------------------------------------------------------
alter table public.patrols enable row level security;

create policy patrols_select on public.patrols for select
using (
  public.is_admin()
  or public.is_leader_of_unit(unit_id)
  or public.is_enrolled_in_unit(unit_id)
);

create policy patrols_write on public.patrols for all
using (public.is_admin_or_leader_of(unit_id))
with check (public.is_admin_or_leader_of(unit_id));

-- ---------------------------------------------------------------------------
-- patrol_memberships
-- ---------------------------------------------------------------------------
alter table public.patrol_memberships enable row level security;

create policy patrol_memberships_select on public.patrol_memberships for select
using (
  person_id = public.current_uid()
  or public.is_admin()
  or public.shares_active_patrol(person_id)
  or exists (
    select 1 from public.patrols p
    where p.id = patrol_memberships.patrol_id
      and public.is_leader_of_unit(p.unit_id)
  )
);

create policy patrol_memberships_write on public.patrol_memberships for all
using (
  public.is_admin()
  or exists (
    select 1 from public.patrols p
    where p.id = patrol_memberships.patrol_id
      and public.is_leader_of_unit(p.unit_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.patrols p
    where p.id = patrol_memberships.patrol_id
      and public.is_leader_of_unit(p.unit_id)
  )
);

-- ---------------------------------------------------------------------------
-- leaders — scouts never see this table. A leader sees only their own row.
-- ---------------------------------------------------------------------------
alter table public.leaders enable row level security;

create policy leaders_select on public.leaders for select
using (
  person_id = public.current_uid()
  or public.is_admin()
);

create policy leaders_write_admin on public.leaders for all
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
alter table public.sessions enable row level security;

create policy sessions_select on public.sessions for select
using (
  public.is_admin()
  or public.is_leader_of_unit(unit_id)
  or public.is_enrolled_in_unit(unit_id)
);

create policy sessions_write on public.sessions for all
using (public.is_admin_or_leader_of(unit_id))
with check (public.is_admin_or_leader_of(unit_id));

-- ---------------------------------------------------------------------------
-- quests — scouts only ever see published, non-expired quests in their unit.
-- ---------------------------------------------------------------------------
alter table public.quests enable row level security;

create policy quests_select on public.quests for select
using (
  public.is_admin()
  or public.is_leader_of_unit(unit_id)
  or (
    public.is_enrolled_in_unit(unit_id)
    and published_at is not null
    and (expires_at is null or expires_at > now())
  )
);

-- Unit-scoped, not creator-scoped: any leader in the unit can edit any quest
-- in that unit's board. This is what the "leader cannot update another
-- leader's quests" pgTAP case actually tests — cross-unit, not cross-leader.
create policy quests_write on public.quests for all
using (public.is_admin_or_leader_of(unit_id))
with check (public.is_admin_or_leader_of(unit_id));

-- ---------------------------------------------------------------------------
-- quest_translations — mirrors quests visibility via the parent quest.
-- ---------------------------------------------------------------------------
alter table public.quest_translations enable row level security;

create policy quest_translations_select on public.quest_translations for select
using (
  exists (
    select 1 from public.quests q
    where q.id = quest_translations.quest_id
      and (
        public.is_admin()
        or public.is_leader_of_unit(q.unit_id)
        or (
          public.is_enrolled_in_unit(q.unit_id)
          and q.published_at is not null
          and (q.expires_at is null or q.expires_at > now())
        )
      )
  )
);

create policy quest_translations_write on public.quest_translations for all
using (
  exists (
    select 1 from public.quests q
    where q.id = quest_translations.quest_id
      and public.is_admin_or_leader_of(q.unit_id)
  )
)
with check (
  exists (
    select 1 from public.quests q
    where q.id = quest_translations.quest_id
      and public.is_admin_or_leader_of(q.unit_id)
  )
);

-- ---------------------------------------------------------------------------
-- quest_prereqs — visibility follows the gated quest (quest_id).
-- ---------------------------------------------------------------------------
alter table public.quest_prereqs enable row level security;

create policy quest_prereqs_select on public.quest_prereqs for select
using (
  exists (
    select 1 from public.quests q
    where q.id = quest_prereqs.quest_id
      and (
        public.is_admin()
        or public.is_leader_of_unit(q.unit_id)
        or (
          public.is_enrolled_in_unit(q.unit_id)
          and q.published_at is not null
          and (q.expires_at is null or q.expires_at > now())
        )
      )
  )
);

create policy quest_prereqs_write on public.quest_prereqs for all
using (
  exists (
    select 1 from public.quests q
    where q.id = quest_prereqs.quest_id
      and public.is_admin_or_leader_of(q.unit_id)
  )
)
with check (
  exists (
    select 1 from public.quests q
    where q.id = quest_prereqs.quest_id
      and public.is_admin_or_leader_of(q.unit_id)
  )
);

-- ---------------------------------------------------------------------------
-- ledger — append-only. Scouts see only their own rows (raw ledger rows for
-- patrol-mates are NOT exposed here — too much detail per row; a
-- patrol-standings view/function belongs to whichever task builds
-- standings). Nobody writes directly: revoked below, Task 04 owns the only
-- write path (SECURITY DEFINER functions).
-- ---------------------------------------------------------------------------
alter table public.ledger enable row level security;

create policy ledger_select on public.ledger for select
using (
  person_id = public.current_uid()
  or public.is_admin()
  or exists (
    select 1 from public.unit_enrollments ue
    where ue.person_id = ledger.person_id
      and (ue.ended_at is null or ue.ended_at > now())
      and public.is_leader_of_unit(ue.unit_id)
  )
);

revoke insert, update, delete on public.ledger from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
alter table public.attendance enable row level security;

create policy attendance_select on public.attendance for select
using (
  person_id = public.current_uid()
  or public.is_admin()
  or exists (
    select 1 from public.sessions s
    where s.id = attendance.session_id
      and public.is_leader_of_unit(s.unit_id)
  )
);

create policy attendance_write_staff on public.attendance for all
using (
  public.is_admin()
  or exists (
    select 1 from public.sessions s
    where s.id = attendance.session_id
      and public.is_leader_of_unit(s.unit_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.sessions s
    where s.id = attendance.session_id
      and public.is_leader_of_unit(s.unit_id)
  )
);

-- A scout may submit their own advance excuse — nothing else. Never
-- present/absent, and never someone else's row.
create policy attendance_insert_own_excuse on public.attendance for insert
with check (
  person_id = public.current_uid()
  and status = 'excused'
);

-- ---------------------------------------------------------------------------
-- audit_log — admin-read-only, and genuinely append-only: no UPDATE/DELETE
-- policy for ANYONE, admin included. Writes happen only via future
-- SECURITY DEFINER functions (same shape as the ledger).
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

create policy audit_log_select_admin on public.audit_log for select
using (public.is_admin());

revoke insert, update, delete on public.audit_log from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- anon: no policy anywhere grants it a row, so every one of the above
-- selects returns zero rows for anon regardless of the SELECT grants above.
-- That's the "anon role can read nothing at all" pgTAP case.
-- ---------------------------------------------------------------------------
