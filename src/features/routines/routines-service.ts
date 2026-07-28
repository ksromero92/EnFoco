/**
 * Routines service — data access layer for cycles, categories, activities
 * and schedules. All queries filter by user_id even though RLS is active.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables, TablesInsert } from '@/src/types/database';

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

// ---------------------------------------------------------------------------
// Mutations
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

export async function deleteActivity(activityId: string, userId: string) {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)
    .eq('user_id', userId);

  return { error };
}
