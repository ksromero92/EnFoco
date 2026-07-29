-- =============================================================================
-- Migration: ensure_task_occurrences RPC
-- Description: Idempotent function that materializes recurring tasks from
--              activity_schedules into task_occurrences for a date range.
-- =============================================================================

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
  -- 1. Authenticate
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  -- 2. Validate parameters
  if p_date_from is null or p_date_to is null then
    raise exception 'Las fechas de inicio y fin son obligatorias.' using errcode = 'P0020';
  end if;

  if p_date_from > p_date_to then
    raise exception 'La fecha de inicio debe ser menor o igual a la fecha de fin.' using errcode = 'P0021';
  end if;

  if (p_date_to - p_date_from) > 30 then
    raise exception 'El rango máximo permitido es 31 días.' using errcode = 'P0022';
  end if;

  -- 3. Get and lock the active cycle
  select * into v_cycle
  from public.cycles
  where user_id = v_user_id
    and status = 'active'
  for update;

  if v_cycle.id is null then
    return 0;
  end if;

  -- 4. Calculate effective range (intersection of request and cycle)
  v_effective_from := greatest(p_date_from, v_cycle.start_date);
  v_effective_to := least(p_date_to, v_cycle.end_date);

  if v_effective_from > v_effective_to then
    return 0;
  end if;

  -- 5. Insert recurring task_occurrences for each (schedule, date) combination
  --    that doesn't already exist (idempotent via ON CONFLICT DO NOTHING on
  --    the partial unique index: schedule_id, planned_date WHERE schedule_id IS NOT NULL).
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
  ),
  -- Calculate position for each new task per date.
  -- Start after the current max position for that date, then increment by 1000.
  -- Order: tasks with start_time first (ascending), then without, then by title.
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
-- Permissions
-- ---------------------------------------------------------------------------

revoke execute on function public.ensure_task_occurrences(date, date) from public, anon;
grant execute on function public.ensure_task_occurrences(date, date) to authenticated;
