/**
 * Task occurrences service — materialisation, queries and mutations for the
 * daily board backed by public.task_occurrences.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database';

export type TaskOccurrence = Tables<'task_occurrences'>;

// ---------------------------------------------------------------------------
// Materialisation
// ---------------------------------------------------------------------------

/**
 * Calls the ensure_task_occurrences RPC to generate recurring tasks for a
 * date range. Idempotent — safe to call on every screen focus.
 */
export async function ensureTaskOccurrences(dateFrom: string, dateTo: string) {
  const { data, error } = await supabase.rpc('ensure_task_occurrences', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  return { inserted: (data as number | null) ?? 0, error };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all task_occurrences for a specific date, ordered by position then
 * start_time then title.
 */
export async function getTasksForDate(userId: string, plannedDate: string) {
  const { data, error } = await supabase
    .from('task_occurrences')
    .select('*')
    .eq('user_id', userId)
    .eq('planned_date', plannedDate)
    .order('position', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });

  return { data: data ?? [], error };
}

/**
 * Get the active cycle for the user (used for cycle day indicator).
 */
export async function getActiveCycle(userId: string) {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return { data, error };
}

/**
 * Get categories by IDs (for display).
 */
export async function getCategoriesByIds(userId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) return { data: [], error: null };
  const unique = [...new Set(categoryIds)];
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .in('id', unique);
  return { data: data ?? [], error };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CompletionInput {
  status: string;
  completed_value: number | null;
  completed_minutes: number | null;
}

/**
 * Update task completion fields and return the updated row.
 */
export async function updateTaskCompletion(
  userId: string,
  taskId: string,
  input: CompletionInput,
) {
  const { data, error } = await supabase
    .from('task_occurrences')
    .update({
      status: input.status,
      completed_value: input.completed_value,
      completed_minutes: input.completed_minutes,
    })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single();

  return { data, error };
}

/**
 * Reorder all tasks for a date using the RPC that assigns positions atomically.
 * The order of IDs in the array determines the final position (1000, 2000, ...).
 */
export async function reorderTasksForDate(plannedDate: string, orderedTaskIds: string[]) {
  const { data, error } = await supabase.rpc('reorder_task_occurrences', {
    p_planned_date: plannedDate,
    p_task_ids: orderedTaskIds,
  });
  return { updated: (data as number | null) ?? 0, error };
}

// ---------------------------------------------------------------------------
// Temporary compatibility: sync to activity_logs
// ---------------------------------------------------------------------------
// TODO: Remove once Semana and Progreso are migrated to task_occurrences.
// This upserts an activity_log mirroring the task completion so that the
// legacy screens (week, progress) continue to reflect accurate data.

/**
 * Sync a recurring task's completion to activity_logs for backward compat.
 * Only syncs if task has source='recurring' and activity_id is not null.
 * Failures here do NOT revert the task_occurrence update.
 */
export async function syncToActivityLog(task: TaskOccurrence) {
  // Only sync recurring tasks with a linked activity
  if (task.source !== 'recurring' || !task.activity_id) return { error: null };

  const { error } = await supabase
    .from('activity_logs')
    .upsert(
      {
        user_id: task.user_id,
        activity_id: task.activity_id,
        log_date: task.planned_date,
        status: task.status === 'completed' ? 'completed'
          : task.status === 'partial' ? 'partial'
          : 'pending',
        completed_value: task.completed_value,
        completed_minutes: task.completed_minutes,
        note: task.note,
      },
      { onConflict: 'activity_id,log_date' },
    );

  return { error };
}
