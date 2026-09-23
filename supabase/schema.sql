-- GroundWork CRM — shared workspace schema
-- Run this in your Supabase project's SQL editor.
-- It is safe to run more than once, and safe to run on a project that already
-- has data: existing leads are copied into the new per-lead table automatically.

-- ---------------------------------------------------------------------------
-- 1. crm_state: small shared settings/counters (campaigns, call results, timesheet…)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_state (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.crm_state enable row level security;

drop policy if exists "Signed-in users can read crm_state" on public.crm_state;
create policy "Signed-in users can read crm_state"
  on public.crm_state for select to authenticated using (true);

drop policy if exists "Signed-in users can write crm_state" on public.crm_state;
create policy "Signed-in users can write crm_state"
  on public.crm_state for insert to authenticated with check (true);

drop policy if exists "Signed-in users can update crm_state" on public.crm_state;
create policy "Signed-in users can update crm_state"
  on public.crm_state for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2. crm_leads: ONE ROW PER LEAD (so two people editing different leads can't
--    overwrite each other)
--      sort_key : position in the list (new leads go to the front)
--      version  : bumped by the trigger below on every write
--      writer   : which browser tab made the write (used to ignore our own echoes)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_leads (
  id text primary key,
  value jsonb not null,
  sort_key double precision not null default 0,
  version bigint not null default 1,
  writer text,
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_sort_idx on public.crm_leads (sort_key, id);

create or replace function public.crm_leads_bump()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_leads_bump on public.crm_leads;
create trigger crm_leads_bump
  before insert or update on public.crm_leads
  for each row execute function public.crm_leads_bump();

alter table public.crm_leads enable row level security;

drop policy if exists "Signed-in users can read crm_leads" on public.crm_leads;
create policy "Signed-in users can read crm_leads"
  on public.crm_leads for select to authenticated using (true);

drop policy if exists "Signed-in users can insert crm_leads" on public.crm_leads;
create policy "Signed-in users can insert crm_leads"
  on public.crm_leads for insert to authenticated with check (true);

drop policy if exists "Signed-in users can update crm_leads" on public.crm_leads;
create policy "Signed-in users can update crm_leads"
  on public.crm_leads for update to authenticated using (true) with check (true);

drop policy if exists "Signed-in users can delete crm_leads" on public.crm_leads;
create policy "Signed-in users can delete crm_leads"
  on public.crm_leads for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. One-time copy of the OLD single-row leads (crm_state.id = 'leads') into
--    crm_leads. The old row is left in place as a backup; it is no longer used.
-- ---------------------------------------------------------------------------
do $$
declare
  legacy jsonb;
begin
  select value into legacy from public.crm_state where id = 'leads';

  if legacy is not null and jsonb_typeof(legacy) = 'array' then
    insert into public.crm_leads (id, value, sort_key)
    select elem->>'id', elem, (ord - 1)::double precision
    from jsonb_array_elements(legacy) with ordinality as t(elem, ord)
    where elem->>'id' is not null
    on conflict (id) do nothing;
  end if;

  -- Remember that leads have been set up, so an intentionally empty list is never re-seeded.
  if exists (select 1 from public.crm_leads) then
    insert into public.crm_state (id, value)
    values ('leads_migrated', 'true'::jsonb)
    on conflict (id) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Daily call-results reset — decided by the DATABASE, once per Dallas day.
--    The first signed-in browser to notice a new Dallas date "claims" the day
--    (function returns true and resets the counts). Everyone else gets false.
--    A device with a wrong clock can't roll the day backwards.
-- ---------------------------------------------------------------------------
create or replace function public.claim_call_results_day(today text)
returns boolean
language plpgsql
as $$
declare
  prev jsonb;
begin
  select value into prev from public.crm_state where id = 'call_results_date' for update;

  if not found then
    -- First ever run: just record today. Nothing to reset.
    insert into public.crm_state (id, value) values ('call_results_date', to_jsonb(today))
    on conflict (id) do nothing;
    return false;
  end if;

  if today <= (prev #>> '{}') then
    return false; -- same day already claimed (or this device's clock is behind)
  end if;

  update public.crm_state
     set value = to_jsonb(today), updated_at = now()
   where id = 'call_results_date';
  return true;
end;
$$;

revoke all on function public.claim_call_results_day(text) from public, anon;
grant execute on function public.claim_call_results_day(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Realtime (live updates between users). Guarded, so re-running is harmless.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_state'
  ) then
    alter publication supabase_realtime add table public.crm_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_leads'
  ) then
    alter publication supabase_realtime add table public.crm_leads;
  end if;
end;
$$;
