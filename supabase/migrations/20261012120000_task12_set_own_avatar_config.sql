-- Task 12 — a scout edits their own avatar (docs/tasks/12-avatar.md).
-- people.avatar_config (Wave 1 schema) already exists, but there is no RLS
-- policy letting a person update their own people row — people_update_admin
-- is the only UPDATE policy. Same situation as locale (Task 11), same answer:
-- a narrow SECURITY DEFINER function that touches only this one column,
-- rather than a general self-update policy (RLS is row-level, not
-- column-level, so that would also let a scout rewrite display_name).
-- Same shape as set_own_locale()/award_points().
--
-- The jsonb_typeof guard rejects a scalar or array config outright — the
-- column stores an avatar config object and nothing else, and it keeps a
-- crafted RPC call from parking arbitrary json on the row. App-layer zod
-- validation (lib/avatar.ts) is the convenience check; this is the floor.
--
-- Note (same as every other SECURITY DEFINER function here): the
-- `grant ... to authenticated` is not what blocks anon — Postgres grants
-- EXECUTE to PUBLIC by default and nothing revokes it. The real boundary is
-- current_uid() being null with no session, so the UPDATE matches no row.
create or replace function public.set_own_avatar_config(p_config jsonb)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  update public.people
  set avatar_config = p_config
  where id = public.current_uid()
    and jsonb_typeof(p_config) = 'object';
$$;

grant execute on function public.set_own_avatar_config(jsonb) to authenticated;
