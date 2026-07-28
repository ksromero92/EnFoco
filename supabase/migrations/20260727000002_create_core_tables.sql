-- =============================================================================
-- Migration: create core tables
-- Description: cycles, categories, activities, activity_schedules, activity_logs
--              with RLS, updated_at triggers, and initial data seeding.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Generic updated_at function (reused across all tables)
-- ---------------------------------------------------------------------------

create or replace function public.handle_updated_at()
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

-- ---------------------------------------------------------------------------
-- 2. Table: public.cycles
-- ---------------------------------------------------------------------------

create table public.cycles (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null
    constraint cycles_name_trimmed check (name = trim(name) and name <> ''),
  start_date  date        not null,
  end_date    date        not null,
  status      text        not null default 'active'
    constraint cycles_status_valid check (status in ('active', 'completed', 'archived')),
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),

  constraint cycles_dates_valid check (end_date >= start_date),
  constraint cycles_id_user_id_unique unique (id, user_id)
);

-- At most one active cycle per user
create unique index idx_cycles_one_active_per_user
  on public.cycles (user_id)
  where (status = 'active');

create trigger trg_cycles_updated_at
  before update on public.cycles
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Table: public.categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  name       text        not null
    constraint categories_name_trimmed check (name = trim(name) and name <> ''),
  color      text        not null default '#2563EB',
  icon       text,
  position   integer     not null default 0,
  is_active  boolean     not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint categories_id_user_id_unique unique (id, user_id)
);

-- Unique category name per user (case-insensitive)
create unique index idx_categories_unique_name_per_user
  on public.categories (user_id, lower(name));

create trigger trg_categories_updated_at
  before update on public.categories
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Table: public.activities
-- ---------------------------------------------------------------------------

create table public.activities (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users (id) on delete cascade,
  cycle_id                uuid        not null,
  category_id             uuid        not null,
  name                    text        not null
    constraint activities_name_trimmed check (name = trim(name) and name <> ''),
  description             text,
  tracking_type           text        not null default 'boolean'
    constraint activities_tracking_type_valid check (
      tracking_type in ('boolean', 'minutes', 'quantity', 'percentage')
    ),
  target_value            numeric     constraint activities_target_positive check (target_value > 0),
  unit                    text,
  default_duration_minutes integer    constraint activities_duration_range check (
    default_duration_minutes between 1 and 1440
  ),
  weight                  numeric     not null default 1
    constraint activities_weight_positive check (weight > 0),
  is_active               boolean     not null default true,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now()),

  constraint activities_id_user_id_unique unique (id, user_id),

  -- Ensure cycle belongs to same user
  constraint activities_cycle_fk
    foreign key (cycle_id, user_id)
    references public.cycles (id, user_id)
    on delete cascade,

  -- Ensure category belongs to same user
  constraint activities_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete cascade
);

create trigger trg_activities_updated_at
  before update on public.activities
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Table: public.activity_schedules
-- ---------------------------------------------------------------------------

create table public.activity_schedules (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  activity_id      uuid        not null,
  weekday          smallint    not null
    constraint schedules_weekday_valid check (weekday between 1 and 7),
  start_time       time,
  duration_minutes integer     constraint schedules_duration_range check (
    duration_minutes between 1 and 1440
  ),
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),

  -- One schedule per activity per weekday
  constraint schedules_unique_activity_weekday unique (activity_id, weekday),

  -- Ensure activity belongs to same user
  constraint schedules_activity_fk
    foreign key (activity_id, user_id)
    references public.activities (id, user_id)
    on delete cascade
);

create trigger trg_activity_schedules_updated_at
  before update on public.activity_schedules
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Table: public.activity_logs
-- ---------------------------------------------------------------------------

create table public.activity_logs (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  activity_id       uuid        not null,
  log_date          date        not null,
  status            text        not null
    constraint logs_status_valid check (status in ('pending', 'partial', 'completed', 'justified')),
  completed_value   numeric     constraint logs_completed_value_non_negative check (completed_value >= 0),
  completed_minutes integer     constraint logs_completed_minutes_non_negative check (completed_minutes >= 0),
  note              text,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),

  -- One log per activity per date
  constraint logs_unique_activity_date unique (activity_id, log_date),

  -- Ensure activity belongs to same user
  constraint logs_activity_fk
    foreign key (activity_id, user_id)
    references public.activities (id, user_id)
    on delete cascade
);

create trigger trg_activity_logs_updated_at
  before update on public.activity_logs
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.cycles enable row level security;
alter table public.categories enable row level security;
alter table public.activities enable row level security;
alter table public.activity_schedules enable row level security;
alter table public.activity_logs enable row level security;

-- cycles
create policy "cycles_select_own" on public.cycles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "cycles_insert_own" on public.cycles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cycles_update_own" on public.cycles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cycles_delete_own" on public.cycles
  for delete to authenticated using (user_id = (select auth.uid()));

-- categories
create policy "categories_select_own" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "categories_insert_own" on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "categories_update_own" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories_delete_own" on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- activities
create policy "activities_select_own" on public.activities
  for select to authenticated using (user_id = (select auth.uid()));
create policy "activities_insert_own" on public.activities
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "activities_update_own" on public.activities
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "activities_delete_own" on public.activities
  for delete to authenticated using (user_id = (select auth.uid()));

-- activity_schedules
create policy "schedules_select_own" on public.activity_schedules
  for select to authenticated using (user_id = (select auth.uid()));
create policy "schedules_insert_own" on public.activity_schedules
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "schedules_update_own" on public.activity_schedules
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "schedules_delete_own" on public.activity_schedules
  for delete to authenticated using (user_id = (select auth.uid()));

-- activity_logs
create policy "logs_select_own" on public.activity_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "logs_insert_own" on public.activity_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "logs_update_own" on public.activity_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "logs_delete_own" on public.activity_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.cycles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.activity_schedules to authenticated;
grant select, insert, update, delete on public.activity_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Revoke EXECUTE on trigger function
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Seed function: create default cycle + categories for a user
-- ---------------------------------------------------------------------------

create or replace function public.seed_new_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Create default cycle if none exists for this user
  insert into public.cycles (user_id, name, start_date, end_date, status)
  select
    p_user_id,
    'Mi primer ciclo',
    current_date,
    current_date + 89,
    'active'
  where not exists (
    select 1 from public.cycles where user_id = p_user_id and status = 'active'
  );

  -- Create default categories (skip if name already exists for user)
  insert into public.categories (user_id, name, color, position)
  values
    (p_user_id, 'Trabajo',  '#2563EB', 0),
    (p_user_id, 'Estudio',  '#8B5CF6', 1),
    (p_user_id, 'Ejercicio','#10B981', 2),
    (p_user_id, 'Personal', '#F59E0B', 3)
  on conflict (user_id, lower(name)) do nothing;
end;
$$;

revoke execute on function public.seed_new_user_data(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. Trigger: seed data for new users (fires after profile creation)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_seed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_new_user_data(new.id);
  return new;
end;
$$;

create trigger trg_profiles_after_insert_seed
  after insert on public.profiles
  for each row
  execute function public.handle_new_user_seed();

revoke execute on function public.handle_new_user_seed() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. Backfill: seed data for existing profiles
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.seed_new_user_data(r.id);
  end loop;
end;
$$;
