-- =============================================================================
-- Migration: create public.profiles
-- Description: User profiles table with RLS, auto-creation trigger, and
--              automatic updated_at management.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: public.profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                    uuid        primary key references auth.users (id) on delete cascade,
  full_name             text                    default null
    constraint profiles_full_name_trimmed check (full_name is null or full_name = trim(full_name)),
  timezone              text        not null    default 'America/Bogota'
    constraint profiles_timezone_valid check (timezone = trim(timezone) and timezone <> ''),
  onboarding_completed  boolean     not null    default false,
  created_at            timestamptz not null    default timezone('utc', now()),
  updated_at            timestamptz not null    default timezone('utc', now())
);

comment on table public.profiles is
  'User profiles — one row per auth.users entry. Created automatically via trigger.';

-- ---------------------------------------------------------------------------
-- 2. Function & trigger: auto-update updated_at on every UPDATE
-- ---------------------------------------------------------------------------

create or replace function public.handle_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_profiles_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Function & trigger: auto-create profile on new auth.users row
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, timezone, onboarding_completed)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'America/Bogota',
    false
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();

-- ---------------------------------------------------------------------------
-- 4. Backfill existing users
-- ---------------------------------------------------------------------------

insert into public.profiles (id, full_name, timezone, onboarding_completed)
select
  id,
  nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
  'America/Bogota',
  false
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Authenticated users can read only their own profile
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Authenticated users can insert only their own profile (safety net)
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- Authenticated users can update only their own profile
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No DELETE policy — profiles cannot be deleted from the client

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------

-- Since auto_expose_new_tables is unset, we must explicitly grant access.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Anon gets no access to profiles
-- (no grant statement for anon)

-- ---------------------------------------------------------------------------
-- 7. Revoke EXECUTE on trigger functions from unnecessary roles
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_profiles_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
