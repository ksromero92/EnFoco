-- =============================================================================
-- Migration: reorder_task_occurrences RPC
-- Description: Atomically reassigns positions for all tasks on a given date
--              based on the order of the provided UUID array.
-- =============================================================================

create or replace function public.reorder_task_occurrences(
  p_planned_date date,
  p_task_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_count integer;
  v_existing_count integer;
  v_id uuid;
  v_pos integer;
  v_updated integer := 0;
begin
  -- 1. Authenticate
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  -- 2. Validate parameters
  if p_planned_date is null then
    raise exception 'La fecha es obligatoria.' using errcode = 'P0030';
  end if;

  if p_task_ids is null or array_length(p_task_ids, 1) is null then
    raise exception 'El arreglo de tareas es obligatorio.' using errcode = 'P0031';
  end if;

  v_count := array_length(p_task_ids, 1);

  -- 3. No duplicates in the array
  if v_count <> (select count(distinct u) from unnest(p_task_ids) u) then
    raise exception 'El arreglo contiene IDs duplicados.' using errcode = 'P0032';
  end if;

  -- 4. All tasks must belong to the user and the specified date
  if exists (
    select 1 from unnest(p_task_ids) tid
    where not exists (
      select 1 from public.task_occurrences t
      where t.id = tid
        and t.user_id = v_user_id
        and t.planned_date = p_planned_date
    )
  ) then
    raise exception 'Algunas tareas no existen, no te pertenecen o no corresponden a la fecha indicada.' using errcode = 'P0033';
  end if;

  -- 5. The array must contain ALL tasks for that date (no partial reorder)
  select count(*) into v_existing_count
  from public.task_occurrences
  where user_id = v_user_id
    and planned_date = p_planned_date;

  if v_count <> v_existing_count then
    raise exception 'El arreglo debe contener todas las tareas del día (esperadas: %, recibidas: %).',
      v_existing_count, v_count
    using errcode = 'P0034';
  end if;

  -- 6. Assign positions: 1000, 2000, 3000, ...
  v_pos := 0;
  foreach v_id in array p_task_ids loop
    v_pos := v_pos + 1000;

    update public.task_occurrences
    set position = v_pos
    where id = v_id
      and user_id = v_user_id
      and planned_date = p_planned_date;

    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

revoke execute on function public.reorder_task_occurrences(date, uuid[]) from public, anon;
grant execute on function public.reorder_task_occurrences(date, uuid[]) to authenticated;
