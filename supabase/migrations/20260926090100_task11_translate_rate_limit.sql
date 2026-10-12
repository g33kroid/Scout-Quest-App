-- Task 11 — per-leader rate limit on the quest-translate call
-- (.env.example: "LLM_API_KEY ... Rate-limited per leader"). This isn't a
-- data-access boundary like the ledger or quests — nobody but this app's
-- own server code can ever reach the translator (lib/server/translator.ts),
-- so it's a cost/abuse throttle, not RLS. Sliding window over a log table
-- rather than a lockout counter (ip_rate_limits' shape): a translate call
-- isn't a failed-credential attempt, it doesn't need escalating lockouts,
-- just a cap.
create table public.translation_calls (
  id uuid primary key default public.uuid_generate_v7(),
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index on public.translation_calls (person_id, created_at);

alter table public.translation_calls enable row level security;
-- No direct read/write for anyone — the function below is the only door.
revoke all on public.translation_calls from authenticated, anon, public;

-- 20 calls/hour/leader: generous for authoring a season's worth of quests in
-- one sitting, low enough to bound API cost if something runs away (a retry
-- loop, a script). Consumes quota and records the call in one step so a
-- caller can't check-then-act around it.
create or replace function public.try_consume_translate_quota()
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_person_id uuid := public.current_uid();
  v_count int;
begin
  if v_person_id is null then
    return false;
  end if;

  select count(*) into v_count
  from public.translation_calls
  where person_id = v_person_id
    and created_at > now() - interval '1 hour';

  if v_count >= 20 then
    return false;
  end if;

  insert into public.translation_calls (person_id) values (v_person_id);
  return true;
end;
$$;

grant execute on function public.try_consume_translate_quota() to authenticated;
