-- =============================================================================
-- Migration: restrict start_new_cycle to today only
-- Description: Replaces start_new_cycle to validate that p_start_date equals
--              the current date in the user's configured timezone.
-- =============================================================================

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
  v_timezone text;
  v_today date;
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

  -- Get user timezone from profile
  select timezone into v_timezone
  from public.profiles
  where id = v_user_id;

  if v_timezone is null or v_timezone = '' then
    v_timezone := 'America/Bogota';
  end if;

  -- Calculate today in the user's timezone
  v_today := (now() at time zone v_timezone)::date;

  -- Validate start date is today
  if p_start_date <> v_today then
    raise exception 'El nuevo ciclo debe comenzar hoy.' using errcode = 'P0007';
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

-- Permissions remain unchanged (already granted in previous migration)
