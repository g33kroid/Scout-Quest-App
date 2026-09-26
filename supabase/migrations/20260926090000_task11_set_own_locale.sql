-- Task 11 — locale preference persists across devices for the same scout
-- (docs/tasks/11-bilingual.md). `people.locale` already exists (Wave 1
-- schema) but there is no RLS policy letting a person update their own row
-- at all — `people_update_admin` is the only UPDATE policy, admin-only.
-- Rather than open a general self-update policy (RLS is row-level, not
-- column-level, so that would also let a person rewrite their own
-- display_name/avatar_config through the same door), a narrow SECURITY
-- DEFINER function that touches only this one column — same shape as
-- award_points()/patrol_total_for_scout().
create or replace function public.set_own_locale(p_locale public.locale_code)
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  update public.people set locale = p_locale where id = public.current_uid();
$$;

grant execute on function public.set_own_locale(public.locale_code) to authenticated;
