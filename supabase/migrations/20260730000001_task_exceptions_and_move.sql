-- =============================================================================
-- Migration: task_occurrence_exceptions + move/delete RPCs + updated ensure
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Prerequisites: add UNIQUE (id, user_id) on task_occurrences
--    Required for the compound FK from task_occurrence_exceptions.
-- ---------------------------------------------------------------------------

alter table public.task_occurrences
  add constraint task_occurrences_id_user_id_unique unique (id, user_id);

-- ---------------------------------------------------------------------------
-- 2. Table: public.task_occurrence_exceptions
-- ---------------------------------------------------------------------------

create table public.task_occurrence_exceptions (
  id                  uuid         primary key default gen_random_uuid(),
  user_id             uuid         not null references auth.users (id) on delete cascade,
  schedule_id         uuid         not null,
  original_date       date         not null,
  exception_type      text         not null
    constraint toe_type_valid check (exception_type in ('skipped', 'moved')),
  target_date         date,
  task_occurrence_id  uuid,
  created_at          timestamptz  not null default timezone('utc', now()),

  -- One exception per schedule per original date
  constraint toe_unique_schedule_date unique (schedule_id, original_date),

  -- target_date required for moved, null for skipped
  constraint toe_target_date_rule check (
    (exception_type = 'moved' and target_date is not null) or
    (exception_type = 'skipped' and target_date is null)
  ),

  -- Ensure schedule belongs to same user
  constraint toe_schedule_fk
    foreign key (schedule_id, user_id)
    references public.activity_schedules (id, user_id)
    on delete cascade,

  -- Ensure task_occurrence belongs to same user (when present)
  constraint toe_task_fk
    foreign key (task_occurrence_id, user_id)
    references public.task_occurrences (id, user_id)
    on delete set null (task_occurrence_id)
);

create index idx_toe_user_date on public.task_occurrence_exceptions (user_id, original_date);
create index idx_toe_schedule_date on public.task_occurrence_exceptions (schedule_id, original_date);

-- RLS
alter table public.task_occurrence_exceptions enable row level security;

create policy "toe_select_own" on public.task_occurrence_exceptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "toe_insert_own" on public.task_occurrence_exceptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "toe_update_own" on public.task_occurrence_exceptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "toe_delete_own" on public.task_occurrence_exceptions
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.task_occurrence_exceptions to authenticated;

-- updated_at trigger (reuse generic)
create trigger trg_toe_updated_at
  before update on public.task_occurrence_exceptions
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Replace ensure_task_occurrences to respect exceptions
-- ---------------------------------------------------------------------------

create or replace function public.ensure_task_occurrences(
  p_date_from date,
  p_date_to date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_cycle public.cycles;
  v_effective_from date;
  v_effective_to date;
  v_inserted integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  if p_date_from is null or p_date_to is null then
    raise exception 'Las fechas de inicio y fin son obligatorias.' using errcode = 'P0020';
  end if;

  if p_date_from > p_date_to then
    raise exception 'La fecha de inicio debe ser menor o igual a la fecha de fin.' using errcode = 'P0021';
  end if;

  if (p_date_to - p_date_from) > 30 then
    raise exception 'El rango máximo permitido es 31 días.' using errcode = 'P0022';
  end if;

  select * into v_cycle
  from public.cycles
  where user_id = v_user_id
    and status = 'active'
  for update;

  if v_cycle.id is null then
    return 0;
  end if;

  v_effective_from := greatest(p_date_from, v_cycle.start_date);
  v_effective_to := least(p_date_to, v_cycle.end_date);

  if v_effective_from > v_effective_to then
    return 0;
  end if;

  with date_series as (
    select d::date as planned_date
    from generate_series(v_effective_from, v_effective_to, interval '1 day') d
  ),
  eligible as (
    select
      a.id as activity_id,
      a.category_id,
      a.name as title,
      a.description as details,
      a.tracking_type,
      a.target_value,
      a.unit,
      a.weight,
      s.id as schedule_id,
      s.weekday,
      s.start_time,
      coalesce(s.duration_minutes, a.default_duration_minutes, 1) as planned_minutes
    from public.activities a
    join public.activity_schedules s
      on s.activity_id = a.id
      and s.user_id = a.user_id
    where a.user_id = v_user_id
      and a.cycle_id = v_cycle.id
      and a.is_active = true
  ),
  to_insert as (
    select
      v_user_id as user_id,
      v_cycle.id as cycle_id,
      e.activity_id,
      e.schedule_id,
      e.category_id,
      e.title,
      e.details,
      ds.planned_date,
      e.start_time,
      e.planned_minutes,
      e.tracking_type,
      e.target_value,
      e.unit,
      e.weight,
      'recurring'::text as source,
      'pending'::text as status
    from date_series ds
    join eligible e
      on e.weekday = extract(isodow from ds.planned_date)::integer
    -- Exclude dates that have an exception (skipped or moved)
    where not exists (
      select 1 from public.task_occurrence_exceptions ex
      where ex.user_id = v_user_id
        and ex.schedule_id = e.schedule_id
        and ex.original_date = ds.planned_date
    )
  ),
  positioned as (
    select
      ti.*,
      coalesce(
        (select max(t.position) from public.task_occurrences t
         where t.user_id = v_user_id and t.planned_date = ti.planned_date),
        0
      ) + (row_number() over (
        partition by ti.planned_date
        order by
          (ti.start_time is null)::integer,
          ti.start_time,
          ti.title,
          ti.schedule_id
      )) * 1000 as position
    from to_insert ti
  )
  insert into public.task_occurrences (
    user_id, cycle_id, activity_id, schedule_id, category_id,
    title, details, planned_date, position, start_time, planned_minutes,
    tracking_type, target_value, unit, weight,
    source, status,
    completed_value, completed_minutes, note
  )
  select
    p.user_id, p.cycle_id, p.activity_id, p.schedule_id, p.category_id,
    p.title, p.details, p.planned_date, p.position::integer, p.start_time, p.planned_minutes,
    p.tracking_type, p.target_value, p.unit, p.weight,
    p.source, p.status,
    null, null, null
  from positioned p
  on conflict (schedule_id, planned_date) where schedule_id is not null
  do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC: move_task_occurrence
-- ---------------------------------------------------------------------------

create or replace function public.move_task_occurrence(
  p_task_id uuid,
  p_target_date date
)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_task public.task_occurrences;
  v_cycle public.cycles;
  v_max_pos integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  if p_target_date is null then
    raise exception 'La fecha destino es obligatoria.' using errcode = 'P0040';
  end if;

  -- Fetch and verify task ownership
  select * into v_task
  from public.task_occurrences
  where id = p_task_id and user_id = v_user_id;

  if v_task.id is null then
    raise exception 'Tarea no encontrada.' using errcode = 'P0041';
  end if;

  if v_task.status <> 'pending' then
    raise exception 'Solo puedes mover tareas pendientes.' using errcode = 'P0042';
  end if;

  if v_task.planned_date = p_target_date then
    raise exception 'La fecha destino debe ser diferente a la actual.' using errcode = 'P0043';
  end if;

  -- Verify target date is within the cycle
  select * into v_cycle
  from public.cycles
  where id = v_task.cycle_id and user_id = v_user_id;

  if v_cycle.id is null then
    raise exception 'Ciclo no encontrado.' using errcode = 'P0044';
  end if;

  if p_target_date < v_cycle.start_date or p_target_date > v_cycle.end_date then
    raise exception 'La fecha destino debe estar dentro del ciclo.' using errcode = 'P0045';
  end if;

  -- If recurring (has schedule_id), create exception
  if v_task.schedule_id is not null then
    insert into public.task_occurrence_exceptions (
      user_id, schedule_id, original_date, exception_type, target_date, task_occurrence_id
    )
    values (
      v_user_id, v_task.schedule_id, v_task.planned_date, 'moved', p_target_date, v_task.id
    )
    on conflict (schedule_id, original_date) do update set
      exception_type = 'moved',
      target_date = excluded.target_date,
      task_occurrence_id = excluded.task_occurrence_id;
  end if;

  -- Get max position on target date
  select coalesce(max(position), 0) into v_max_pos
  from public.task_occurrences
  where user_id = v_user_id and planned_date = p_target_date;

  -- Move the task
  update public.task_occurrences
  set planned_date = p_target_date,
      schedule_id = null,
      source = 'manual',
      position = v_max_pos + 1000
  where id = p_task_id and user_id = v_user_id
  returning * into v_task;

  return v_task;
end;
$$;

revoke execute on function public.move_task_occurrence(uuid, date) from public, anon;
grant execute on function public.move_task_occurrence(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC: delete_task_occurrence_for_day
-- ---------------------------------------------------------------------------

create or replace function public.delete_task_occurrence_for_day(
  p_task_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_task public.task_occurrences;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  select * into v_task
  from public.task_occurrences
  where id = p_task_id and user_id = v_user_id;

  if v_task.id is null then
    raise exception 'Tarea no encontrada.' using errcode = 'P0041';
  end if;

  -- If recurring, create a skipped exception
  if v_task.schedule_id is not null then
    insert into public.task_occurrence_exceptions (
      user_id, schedule_id, original_date, exception_type, target_date, task_occurrence_id
    )
    values (
      v_user_id, v_task.schedule_id, v_task.planned_date, 'skipped', null, null
    )
    on conflict (schedule_id, original_date) do update set
      exception_type = 'skipped',
      target_date = null,
      task_occurrence_id = null;
  end if;

  -- Delete the task occurrence
  delete from public.task_occurrences
  where id = p_task_id and user_id = v_user_id;

  return true;
end;
$$;

revoke execute on function public.delete_task_occurrence_for_day(uuid) from public, anon;
grant execute on function public.delete_task_occurrence_for_day(uuid) to authenticated;
