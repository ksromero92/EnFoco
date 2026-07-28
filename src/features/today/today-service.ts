/**
 * Today service — queries and mutations for the daily board.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database';

export type ActivityRow = Tables<'activities'>;
export type ScheduleRow = Tables<'activity_schedules'>;
export type CategoryRow = Tables<'categories'>;
export type LogRow = Tables<'activity_logs'>;
export type CycleRow = Tables<'cycles'>;

/** Combined item for the today board */
export interface TodayItem {
  activity: ActivityRow;
  category: CategoryRow;
  schedule: ScheduleRow;
  log: LogRow | null;
  scheduledMinutes: number;
  effectiveStatus: 'pending' | 'partial' | 'completed';
  completedMinutes: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get the active cycle that contains today's date */
export async function getActiveCycleForDate(userId: string, todayDate: string) {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('start_date', todayDate)
    .gte('end_date', todayDate)
    .maybeSingle();

  return { data, error };
}

/** Get active activities for a cycle */
export async function getActivitiesForCycle(userId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('is_active', true);

  return { data: data ?? [], error };
}

/** Get schedules for a specific weekday from a list of activities */
export async function getSchedulesForWeekday(
  userId: string,
  activityIds: string[],
  weekday: number,
) {
  if (activityIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('activity_schedules')
    .select('*')
    .eq('user_id', userId)
    .in('activity_id', activityIds)
    .eq('weekday', weekday);

  return { data: data ?? [], error };
}

/** Get categories by IDs */
export async function getCategoriesByIds(userId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) return { data: [], error: null };

  const uniqueIds = [...new Set(categoryIds)];
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .in('id', uniqueIds);

  return { data: data ?? [], error };
}

/** Get existing logs for today */
export async function getLogsForDate(userId: string, activityIds: string[], logDate: string) {
  if (activityIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .in('activity_id', activityIds);

  return { data: data ?? [], error };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Upsert a log entry (uses unique constraint on activity_id + log_date) */
export async function upsertLog(input: {
  user_id: string;
  activity_id: string;
  log_date: string;
  status: string;
  completed_value: number;
  completed_minutes: number;
}) {
  const { data, error } = await supabase
    .from('activity_logs')
    .upsert(input, { onConflict: 'activity_id,log_date' })
    .select()
    .single();

  return { data, error };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** Build today items from raw data */
export function buildTodayItems(
  activities: ActivityRow[],
  schedulesForToday: ScheduleRow[],
  categories: CategoryRow[],
  logs: LogRow[],
): TodayItem[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const logMap = new Map(logs.map((l) => [l.activity_id, l]));

  const items: TodayItem[] = [];

  for (const schedule of schedulesForToday) {
    const activity = activities.find((a) => a.id === schedule.activity_id);
    if (!activity) continue;

    const category = catMap.get(activity.category_id);
    if (!category) continue;

    const log = logMap.get(activity.id) ?? null;
    const scheduledMinutes = schedule.duration_minutes ?? activity.default_duration_minutes ?? 0;

    let effectiveStatus: TodayItem['effectiveStatus'] = 'pending';
    let completedMinutes = 0;

    if (log) {
      if (log.status === 'completed') {
        effectiveStatus = 'completed';
        completedMinutes = scheduledMinutes;
      } else if (log.status === 'partial') {
        effectiveStatus = 'partial';
        completedMinutes = Math.min(Math.max(log.completed_minutes ?? 0, 0), scheduledMinutes);
      }
      // pending or justified → keep defaults
    }

    items.push({ activity, category, schedule, log, scheduledMinutes, effectiveStatus, completedMinutes });
  }

  // Sort: activities with start_time first (ascending), then without, then by name
  items.sort((a, b) => {
    const aTime = a.schedule.start_time;
    const bTime = b.schedule.start_time;
    if (aTime && !bTime) return -1;
    if (!aTime && bTime) return 1;
    if (aTime && bTime) return aTime.localeCompare(bTime);
    return a.activity.name.localeCompare(b.activity.name);
  });

  return items;
}
