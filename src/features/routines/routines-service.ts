/**
 * Routines service — data access layer for cycles, categories, activities
 * and schedules. All queries filter by user_id even though RLS is active.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/src/types/database';

export type Cycle = Tables<'cycles'>;
export type Category = Tables<'categories'>;
export type Activity = Tables<'activities'>;
export type Schedule = Tables<'activity_schedules'>;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getActiveCycle(userId: string) {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  return { data, error };
}

export async function getActiveCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('position', { ascending: true });

  return { data: data ?? [], error };
}

export async function getActivitiesForCycle(userId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  return { data: data ?? [], error };
}

export async function getInactiveActivitiesForCycle(userId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('is_active', false)
    .order('name', { ascending: true });

  return { data: data ?? [], error };
}

export async function getAllActivitiesForCycle(userId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .order('name', { ascending: true });

  return { data: data ?? [], error };
}

export async function getSchedulesForActivities(userId: string, activityIds: string[]) {
  if (activityIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('activity_schedules')
    .select('*')
    .eq('user_id', userId)
    .in('activity_id', activityIds)
    .order('weekday', { ascending: true });

  return { data: data ?? [], error };
}

export async function getSchedulesForActivity(userId: string, activityId: string) {
  const { data, error } = await supabase
    .from('activity_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_id', activityId)
    .order('weekday', { ascending: true });

  return { data: data ?? [], error };
}

/** Check if an activity has any logs (used before deletion) */
export async function activityHasLogs(userId: string, activityId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('activity_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('activity_id', activityId);

  if (error) return true; // Assume has logs on error to prevent deletion
  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Mutations — Create
// ---------------------------------------------------------------------------

export async function createActivity(input: TablesInsert<'activities'>) {
  const { data, error } = await supabase
    .from('activities')
    .insert(input)
    .select()
    .single();

  return { data, error };
}

export async function createSchedules(schedules: TablesInsert<'activity_schedules'>[]) {
  const { data, error } = await supabase
    .from('activity_schedules')
    .insert(schedules)
    .select();

  return { data: data ?? [], error };
}

// ---------------------------------------------------------------------------
// Mutations — Update
// ---------------------------------------------------------------------------

export async function updateActivity(
  activityId: string,
  userId: string,
  input: TablesUpdate<'activities'>,
) {
  const { data, error } = await supabase
    .from('activities')
    .update(input)
    .eq('id', activityId)
    .eq('user_id', userId)
    .select()
    .single();

  return { data, error };
}

export async function deactivateActivity(activityId: string, userId: string) {
  return updateActivity(activityId, userId, { is_active: false });
}

export async function reactivateActivity(activityId: string, userId: string) {
  return updateActivity(activityId, userId, { is_active: true });
}

/**
 * Sync schedules for an activity: upsert selected days, delete deselected.
 * Uses the unique constraint (activity_id, weekday) for conflict resolution.
 */
export async function syncSchedules(
  userId: string,
  activityId: string,
  selectedDays: boolean[],
  startTime: string | null,
  durationMinutes: number,
) {
  // Upsert selected days
  const toUpsert = selectedDays
    .map((selected, index) => {
      if (!selected) return null;
      return {
        user_id: userId,
        activity_id: activityId,
        weekday: index + 1,
        start_time: startTime,
        duration_minutes: durationMinutes,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (toUpsert.length > 0) {
    const { error: upsertErr } = await supabase
      .from('activity_schedules')
      .upsert(toUpsert, { onConflict: 'activity_id,weekday' })
      .select();

    if (upsertErr) return { error: upsertErr };
  }

  // Delete deselected days
  const toDelete = selectedDays
    .map((selected, index) => (!selected ? index + 1 : null))
    .filter((d): d is number => d !== null);

  if (toDelete.length > 0) {
    const { error: deleteErr } = await supabase
      .from('activity_schedules')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .in('weekday', toDelete);

    if (deleteErr) return { error: deleteErr };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Mutations — Delete
// ---------------------------------------------------------------------------

export async function deleteActivity(activityId: string, userId: string) {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)
    .eq('user_id', userId);

  return { error };
}
