/**
 * Week service — queries for the weekly view.
 * Fetches all data for Monday–Sunday in a single load.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database';

export type ActivityRow = Tables<'activities'>;
export type ScheduleRow = Tables<'activity_schedules'>;
export type CategoryRow = Tables<'categories'>;
export type LogRow = Tables<'activity_logs'>;
export type CycleRow = Tables<'cycles'>;

/** A single activity entry for the week view */
export interface WeekActivityItem {
  activity: ActivityRow;
  category: CategoryRow;
  schedule: ScheduleRow;
  log: LogRow | null;
  scheduledMinutes: number;
  effectiveStatus: 'pending' | 'partial' | 'completed';
  completedMinutes: number;
}

/** Summary for a single day */
export interface DaySummary {
  date: string;
  weekday: number;
  items: WeekActivityItem[];
  scheduledMinutes: number;
  completedMinutes: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getActiveCycleForRange(userId: string, mondayDate: string, sundayDate: string) {
  // Get active cycle that overlaps with this week
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('start_date', sundayDate)
    .gte('end_date', mondayDate)
    .maybeSingle();

  return { data, error };
}

export async function getActiveActivities(userId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('is_active', true);

  return { data: data ?? [], error };
}

export async function getAllSchedules(userId: string, activityIds: string[]) {
  if (activityIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('activity_schedules')
    .select('*')
    .eq('user_id', userId)
    .in('activity_id', activityIds)
    .order('weekday', { ascending: true });

  return { data: data ?? [], error };
}

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

export async function getLogsForRange(userId: string, activityIds: string[], mondayDate: string, sundayDate: string) {
  if (activityIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .in('activity_id', activityIds)
    .gte('log_date', mondayDate)
    .lte('log_date', sundayDate);

  return { data: data ?? [], error };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Build week items for a specific weekday + date from raw data.
 */
export function buildDayItems(
  weekday: number,
  date: string,
  activities: ActivityRow[],
  schedules: ScheduleRow[],
  categories: CategoryRow[],
  logs: LogRow[],
): WeekActivityItem[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Schedules for this weekday
  const daySchedules = schedules.filter((s) => s.weekday === weekday);

  const items: WeekActivityItem[] = [];

  for (const schedule of daySchedules) {
    const activity = activities.find((a) => a.id === schedule.activity_id);
    if (!activity) continue;

    const category = catMap.get(activity.category_id);
    if (!category) continue;

    const log = logs.find((l) => l.activity_id === activity.id && l.log_date === date) ?? null;
    const scheduledMinutes = schedule.duration_minutes ?? activity.default_duration_minutes ?? 0;

    let effectiveStatus: WeekActivityItem['effectiveStatus'] = 'pending';
    let completedMinutes = 0;

    if (log) {
      if (log.status === 'completed') {
        effectiveStatus = 'completed';
        completedMinutes = scheduledMinutes;
      } else if (log.status === 'partial') {
        effectiveStatus = 'partial';
        completedMinutes = Math.min(Math.max(log.completed_minutes ?? 0, 0), scheduledMinutes);
      }
    }

    items.push({ activity, category, schedule, log, scheduledMinutes, effectiveStatus, completedMinutes });
  }

  // Sort: with start_time first (ascending), then without, then by name
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

/**
 * Calculate day summary from items.
 */
export function calcDaySummary(date: string, weekday: number, items: WeekActivityItem[]): DaySummary {
  const scheduledMinutes = items.reduce((s, i) => s + i.scheduledMinutes, 0);
  const completedMinutes = items.reduce((s, i) => s + i.completedMinutes, 0);
  const percentage = scheduledMinutes > 0
    ? Math.min(100, Math.max(0, Math.round((completedMinutes / scheduledMinutes) * 100)))
    : 0;

  return { date, weekday, items, scheduledMinutes, completedMinutes, percentage };
}
