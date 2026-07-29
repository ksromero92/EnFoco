-- =============================================================================
-- Migration: create task_occurrences
-- Description: Flexible daily agenda table. Each row is a concrete task placed
--              on a specific day. Allows repeats of the same activity per date.
--              Includes backfill from existing activity_logs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Prerequisites: add (id, user_id) unique to activity_schedules
--    Required for the compound FK from task_occurrences.
-- ---------------------------------------------------------------------------

alter table public.activity_schedules
  add constraint activity_schedules_id_user_id_unique unique (id, user_id);

-- ---------------------------------------------------------------------------
-- 1. Table: public.task_occurrences
-- ---------------------------------------------------------------------------

create table public.task_occurrences (
  id                 uuid         primary key default gen_random_uuid(),
  user_id            uuid         not null references auth.users (id) on delete cascade,
  cycle_id           uuid         not null,
  activity_id        uuid,
  schedule_id        uuid,
  category_id        uuid         not null,

  -- Task content
  title              text         not null
    constraint task_occ_title_trimmed check (title = trim(title) and title <> ''),
  details            text,
  planned_date       date         not null,
  position           integer      not null default 1000
    constraint task_occ_position_non_negative check (position >= 0),
  start_time         time,
  planned_minutes    integer      not null
    constraint task_occ_planned_minutes_range check (planned_minutes between 1 and 1440),

  -- Tracking
  tracking_type      text         not null default 'boolean'
    constraint task_occ_tracking_type_valid check (
      tracking_type in ('boolean', 'minutes', 'quantity', 'percentage')
    ),
  target_value       numeric      constraint task_occ_target_positive check (target_value > 0),
  unit               text,
  weight             numeric      not null default 1
    constraint task_occ_weight_positive check (weight > 0),

  -- Origin
  source             text         not null default 'manual'
    constraint task_occ_source_valid check (source in ('recurring', 'manual', 'one_off')),

  -- Status
  status             text         not null default 'pending'
    constraint task_occ_status_valid check (
      status in ('pending', 'partial', 'completed', 'missed', 'justified')
    ),

  -- Completion
  completed_value    numeric      constraint task_occ_completed_value_non_neg check (completed_value >= 0),
  completed_minutes  integer      constraint task_occ_completed_minutes_non_neg check (completed_minutes >= 0),
  note               text,

  -- Audit
  created_at         timestamptz  not null default timezone('utc', now()),
  updated_at         timestamptz  not null default timezone('utc', now()),

  -- Compound FKs: ensure same user_id
  constraint task_occ_cycle_fk
    foreign key (cycle_id, user_id)
    references public.cycles (id, user_id)
    on delete cascade,

  constraint task_occ_activity_fk
    foreign key (activity_id, user_id)
    references public.activities (id, user_id)
    on delete set null,

  constraint task_occ_schedule_fk
    foreign key (schedule_id, user_id)
    references public.activity_schedules (id, user_id)
    on delete set null,

  constraint task_occ_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete cascade
);

-- ---------------------------------------------------------------------------
-- 2. Unique partial index: prevent duplicate recurring generation
--    Only applies when schedule_id is not null.
-- ---------------------------------------------------------------------------

create unique index idx_task_occ_schedule_date
  on public.task_occurrences (schedule_id, planned_date)
  where schedule_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Performance indexes
-- ---------------------------------------------------------------------------

create index idx_task_occ_user_date
  on public.task_occurrences (user_id, planned_date);

create index idx_task_occ_cycle_date
  on public.task_occurrences (cycle_id, planned_date);

create index idx_task_occ_activity_date
  on public.task_occurrences (activity_id, planned_date);

create index idx_task_occ_user_status
  on public.task_occurrences (user_id, status);

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger (reuse existing generic function)
-- ---------------------------------------------------------------------------

create trigger trg_task_occurrences_updated_at
  before update on public.task_occurrences
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.task_occurrences enable row level security;

create policy "task_occ_select_own" on public.task_occurrences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "task_occ_insert_own" on public.task_occurrences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "task_occ_update_own" on public.task_occurrences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "task_occ_delete_own" on public.task_occurrences
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.task_occurrences to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Backfill from activity_logs
--    Creates one task_occurrence per existing log entry.
-- ---------------------------------------------------------------------------

insert into public.task_occurrences (
  user_id,
  cycle_id,
  activity_id,
  schedule_id,
  category_id,
  title,
  planned_date,
  start_time,
  planned_minutes,
  tracking_type,
  target_value,
  unit,
  weight,
  source,
  status,
  completed_value,
  completed_minutes,
  note
)
select
  al.user_id,
  a.cycle_id,
  al.activity_id,
  -- Find the schedule for the matching weekday (if any)
  (
    select s.id
    from public.activity_schedules s
    where s.activity_id = al.activity_id
      and s.user_id = al.user_id
      and s.weekday = (
        -- Convert log_date to weekday 1=Mon..7=Sun
        case extract(isodow from al.log_date)::integer
          when 1 then 1  -- Monday
          when 2 then 2
          when 3 then 3
          when 4 then 4
          when 5 then 5
          when 6 then 6
          when 7 then 7
        end
      )
    limit 1
  ),
  a.category_id,
  a.name,                               -- title from activity name
  al.log_date,                          -- planned_date
  -- start_time from the matching schedule
  (
    select s2.start_time
    from public.activity_schedules s2
    where s2.activity_id = al.activity_id
      and s2.user_id = al.user_id
      and s2.weekday = extract(isodow from al.log_date)::integer
    limit 1
  ),
  -- planned_minutes: schedule > activity default > completed_minutes > 1
  coalesce(
    (
      select s3.duration_minutes
      from public.activity_schedules s3
      where s3.activity_id = al.activity_id
        and s3.user_id = al.user_id
        and s3.weekday = extract(isodow from al.log_date)::integer
      limit 1
    ),
    a.default_duration_minutes,
    al.completed_minutes,
    1
  ),
  a.tracking_type,
  a.target_value,
  a.unit,
  a.weight,
  'manual',                             -- source (legacy data treated as manual)
  al.status,
  al.completed_value,
  al.completed_minutes,
  al.note
from public.activity_logs al
join public.activities a
  on a.id = al.activity_id
  and a.user_id = al.user_id;
