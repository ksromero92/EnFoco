-- =============================================================================
-- Migration: copy_cycle_routines RPC
-- Description: Copies active activities and their schedules from one cycle
--              to another, both owned by the authenticated user.
-- =============================================================================

create or replace function public.copy_cycle_routines(
  p_source_cycle_id uuid,
  p_target_cycle_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_source public.cycles;
  v_target public.cycles;
  v_target_activity_count integer;
  v_copied integer := 0;
  v_source_activity public.activities;
  v_new_activity_id uuid;
begin
  -- 1. Authenticate
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  -- 2. Validate source and target are different
  if p_source_cycle_id = p_target_cycle_id then
    raise exception 'El ciclo origen y destino deben ser diferentes.' using errcode = 'P0010';
  end if;

  -- 3. Validate source cycle exists and belongs to user
  select * into v_source
  from public.cycles
  where id = p_source_cycle_id
    and user_id = v_user_id;

  if v_source.id is null then
    raise exception 'Ciclo origen no encontrado o no te pertenece.' using errcode = 'P0011';
  end if;

  -- 4. Validate target cycle exists, belongs to user, and is active
  --    Lock the row to prevent concurrent copies
  select * into v_target
  from public.cycles
  where id = p_target_cycle_id
    and user_id = v_user_id
  for update;

  if v_target.id is null then
    raise exception 'Ciclo destino no encontrado o no te pertenece.' using errcode = 'P0012';
  end if;

  if v_target.status <> 'active' then
    raise exception 'El ciclo destino debe estar activo.' using errcode = 'P0013';
  end if;

  -- 5. Validate target is empty
  select count(*) into v_target_activity_count
  from public.activities
  where cycle_id = p_target_cycle_id
    and user_id = v_user_id;

  if v_target_activity_count > 0 then
    raise exception 'El ciclo destino ya contiene rutinas.' using errcode = 'P0014';
  end if;

  -- 6. Copy active activities and their schedules
  for v_source_activity in
    select *
    from public.activities
    where cycle_id = p_source_cycle_id
      and user_id = v_user_id
      and is_active = true
  loop
    -- Generate a new id for the copied activity
    v_new_activity_id := gen_random_uuid();

    -- Insert copied activity
    insert into public.activities (
      id, user_id, cycle_id, category_id, name, description,
      tracking_type, target_value, unit, default_duration_minutes,
      weight, is_active
    )
    values (
      v_new_activity_id,
      v_user_id,
      p_target_cycle_id,
      v_source_activity.category_id,
      v_source_activity.name,
      v_source_activity.description,
      v_source_activity.tracking_type,
      v_source_activity.target_value,
      v_source_activity.unit,
      v_source_activity.default_duration_minutes,
      v_source_activity.weight,
      true
    );

    -- Copy all schedules for this activity
    insert into public.activity_schedules (
      user_id, activity_id, weekday, start_time, duration_minutes
    )
    select
      v_user_id,
      v_new_activity_id,
      weekday,
      start_time,
      duration_minutes
    from public.activity_schedules
    where activity_id = v_source_activity.id
      and user_id = v_user_id;

    v_copied := v_copied + 1;
  end loop;

  return v_copied;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

revoke execute on function public.copy_cycle_routines(uuid, uuid) from public, anon;
grant execute on function public.copy_cycle_routines(uuid, uuid) to authenticated;
