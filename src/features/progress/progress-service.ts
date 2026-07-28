/**
 * Progress service — queries and assembly for the weekly progress view.
 */

import type { CategoryProgress, DayStatus, ProgressDay } from '@/src/features/progress/progress-utils';
import { classifyDay } from '@/src/features/progress/progress-utils';
import type { WeekDay } from '@/src/features/week/week-utils';
import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database';

type ActivityRow = Tables<'activities'>;
type ScheduleRow = Tables<'activity_schedules'>;
type CategoryRow = Tables<'categories'>;
type LogRow = Tables<'activity_logs'>;
export type CycleRow = Tables<'cycles'>;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getActiveCycleForRange(userId: string, mondayDate: string, sundayDate: string) {
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
    .in('activity_id', activityIds);
  return { data: data ?? [], error };
}

export async function getCategories(userId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) return { data: [], error: null };
  const uniqueIds = [...new Set(categoryIds)];
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .in('id', uniqueIds);
  return { data: data ?? [], error };
}

export async function getLogsForRange(userId: string, activityIds: string[], fromDate: string, toDate: string) {
  if (activityIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .in('activity_id', activityIds)
    .gte('log_date', fromDate)
    .lte('log_date', toDate);
  return { data: data ?? [], error };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Build progress days and category progress from raw data.
 */
export function buildProgressData(
  weekDays: WeekDay[],
  todayDate: string,
  activities: ActivityRow[],
  schedules: ScheduleRow[],
  categories: CategoryRow[],
  logs: LogRow[],
): { days: ProgressDay[]; categoryProgress: CategoryProgress[] } {
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Track category stats
  const catStats = new Map<string, { scheduled: number; completed: number }>();

  const days: ProgressDay[] = weekDays.map((day) => {
    // Determine day status
    let status: DayStatus;
    if (day.date < todayDate) status = 'past';
    else if (day.date === todayDate) status = 'today';
    else status = 'future';

    // Schedules for this weekday
    const daySchedules = schedules.filter((s) => s.weekday === day.weekday);

    if (daySchedules.length === 0 || status === 'future') {
      return {
        date: day.date,
        weekday: day.weekday,
        label: day.label,
        dayNumber: day.dayNumber,
        status,
        scheduledMinutes: 0,
        completedMinutes: 0,
        percentage: 0,
        classification: null,
        hasActivities: daySchedules.length > 0,
      };
    }

    let scheduledMinutes = 0;
    let completedMinutes = 0;

    for (const schedule of daySchedules) {
      const activity = activities.find((a) => a.id === schedule.activity_id);
      if (!activity) continue;

      const duration = schedule.duration_minutes ?? activity.default_duration_minutes ?? 0;
      scheduledMinutes += duration;

      const log = logs.find((l) => l.activity_id === activity.id && l.log_date === day.date);
      let realized = 0;

      if (log) {
        if (log.status === 'completed') {
          realized = duration;
        } else if (log.status === 'partial') {
          realized = Math.min(Math.max(log.completed_minutes ?? 0, 0), duration);
        }
      }

      completedMinutes += realized;

      // Accumulate category stats (only for past + today)
      const catId = activity.category_id;
      const existing = catStats.get(catId) ?? { scheduled: 0, completed: 0 };
      existing.scheduled += duration;
      existing.completed += realized;
      catStats.set(catId, existing);
    }

    const percentage = scheduledMinutes > 0
      ? Math.min(100, Math.max(0, Math.round((completedMinutes / scheduledMinutes) * 100)))
      : 0;

    return {
      date: day.date,
      weekday: day.weekday,
      label: day.label,
      dayNumber: day.dayNumber,
      status,
      scheduledMinutes,
      completedMinutes,
      percentage,
      classification: scheduledMinutes > 0 ? classifyDay(percentage) : null,
      hasActivities: true,
    };
  });

  // Build category progress sorted by percentage descending
  const categoryProgress: CategoryProgress[] = [];
  for (const [catId, stats] of catStats) {
    if (stats.scheduled === 0) continue;
    const cat = catMap.get(catId);
    if (!cat) continue;
    categoryProgress.push({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      scheduledMinutes: stats.scheduled,
      completedMinutes: stats.completed,
      percentage: Math.min(100, Math.max(0, Math.round((stats.completed / stats.scheduled) * 100))),
    });
  }
  categoryProgress.sort((a, b) => b.percentage - a.percentage);

  return { days, categoryProgress };
}
