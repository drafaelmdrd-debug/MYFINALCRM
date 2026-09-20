-- GroundWork CRM — shared workspace schema
-- Run this once in your Supabase project's SQL editor.

create table if not exists public.crm_state (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: any signed-in user can read and write every row.
-- This is what makes it a single shared workspace rather than per-user data.
alter table public.crm_state enable row level security;

drop policy if exists "Signed-in users can read crm_state" on public.crm_state;
create policy "Signed-in users can read crm_state"
  on public.crm_state for select
  to authenticated
  using (true);

drop policy if exists "Signed-in users can write crm_state" on public.crm_state;
create policy "Signed-in users can write crm_state"
  on public.crm_state for insert
  to authenticated
  with check (true);

drop policy if exists "Signed-in users can update crm_state" on public.crm_state;
create policy "Signed-in users can update crm_state"
  on public.crm_state for update
  to authenticated
  using (true)
  with check (true);

-- Turn on Realtime so every signed-in tab/user sees changes live.
alter publication supabase_realtime add table public.crm_state;
