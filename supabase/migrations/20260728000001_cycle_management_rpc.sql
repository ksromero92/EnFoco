-- =============================================================================
-- Migration: cycle management RPC functions
-- Description: start_new_cycle and archive_cycle for authenticated users.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. public.start_new_cycle
-- ---------------------------------------------------------------------------

create or replace function public.start_new_cycle(
  p_name text,
  p_start_date date,
  p_duration_days integer
)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_name text;
  v_end_date date;
  v_new_cycle public.cycles;
begin
  -- Authenticate
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  -- Validate name
  v_name := trim(p_name);
  if v_name = '' or v_name is null then
    raise exception 'El nombre del ciclo es obligatorio.' using errcode = 'P0002';
  end if;

  -- Validate duration
  if p_duration_days < 7 or p_duration_days > 365 then
    raise exception 'La duración debe ser entre 7 y 365 días.' using errcode = 'P0003';
  end if;

  -- Calculate end date
  v_end_date := p_start_date + (p_duration_days - 1);

  -- Lock and complete the current active cycle (if any)
  update public.cycles
  set status = 'completed'
  where user_id = v_user_id
    and status = 'active';

  -- Create new cycle
  insert into public.cycles (user_id, name, start_date, end_date, status)
  values (v_user_id, v_name, p_start_date, v_end_date, 'active')
  returning * into v_new_cycle;

  return v_new_cycle;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. public.archive_cycle
-- ---------------------------------------------------------------------------

create or replace function public.archive_cycle(
  p_cycle_id uuid
)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_cycle public.cycles;
begin
  -- Authenticate
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado.' using errcode = 'P0001';
  end if;

  -- Fetch the cycle and verify ownership
  select * into v_cycle
  from public.cycles
  where id = p_cycle_id;

  if v_cycle.id is null then
    raise exception 'Ciclo no encontrado.' using errcode = 'P0004';
  end if;

  if v_cycle.user_id <> v_user_id then
    raise exception 'No tienes permiso para modificar este ciclo.' using errcode = 'P0005';
  end if;

  -- Cannot archive an active cycle
  if v_cycle.status = 'active' then
    raise exception 'No puedes archivar un ciclo activo. Primero inicia un nuevo ciclo o complétalo.' using errcode = 'P0006';
  end if;

  -- Archive
  update public.cycles
  set status = 'archived'
  where id = p_cycle_id
    and user_id = v_user_id
  returning * into v_cycle;

  return v_cycle;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Permissions
-- ---------------------------------------------------------------------------

-- Revoke from public and anon
revoke execute on function public.start_new_cycle(text, date, integer) from public, anon;
revoke execute on function public.archive_cycle(uuid) from public, anon;

-- Grant only to authenticated
grant execute on function public.start_new_cycle(text, date, integer) to authenticated;
grant execute on function public.archive_cycle(uuid) to authenticated;
