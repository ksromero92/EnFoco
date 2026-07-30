/**
 * Task occurrences service — materialisation, queries and mutations for the
 * daily board backed by public.task_occurrences.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/src/types/database';

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
 * Get all task_occurrences for a date range, ordered by date then position.
 */
export async function getTasksForRange(userId: string, dateFrom: string, dateTo: string) {
  const { data, error } = await supabase
    .from('task_occurrences')
    .select('*')
    .eq('user_id', userId)
    .gte('planned_date', dateFrom)
    .lte('planned_date', dateTo)
    .order('planned_date', { ascending: true })
    .order('position', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });

  return { data: data ?? [], error };
}

/**
 * Get the active cycle for the user.
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
 * Get categories by IDs.
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

/**
 * Get all active categories for a user.
 */
export async function getActiveCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('position', { ascending: true });
  return { data: data ?? [], error };
}

/**
 * Get active activities for the active cycle (for "from routine" creation).
 */
export async function getActiveActivitiesForCycle(userId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  return { data: data ?? [], error };
}

/**
 * Get the max position for a user + date (for new tasks at end).
 */
export async function getMaxPosition(userId: string, plannedDate: string): Promise<number> {
  const { data } = await supabase
    .from('task_occurrences')
    .select('position')
    .eq('user_id', userId)
    .eq('planned_date', plannedDate)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.position ?? 0;
}

// ---------------------------------------------------------------------------
// Mutations — Completion
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

// ---------------------------------------------------------------------------
// Mutations — CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new task_occurrence.
 */
export async function createTaskOccurrence(input: TablesInsert<'task_occurrences'>) {
  const { data, error } = await supabase
    .from('task_occurrences')
    .insert(input)
    .select()
    .single();
  return { data, error };
}

/**
 * Update an existing task_occurrence (for editing title, details, time, duration).
 */
export async function updateTaskOccurrence(
  userId: string,
  taskId: string,
  input: TablesUpdate<'task_occurrences'>,
) {
  const { data, error } = await supabase
    .from('task_occurrences')
    .update(input)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

/**
 * Delete a task_occurrence.
 */
export async function deleteTaskOccurrence(userId: string, taskId: string) {
  const { error } = await supabase
    .from('task_occurrences')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);
  return { error };
}

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

/**
 * Reorder all tasks for a date using the RPC.
 */
export async function reorderTasksForDate(plannedDate: string, orderedTaskIds: string[]) {
  const { data, error } = await supabase.rpc('reorder_task_occurrences', {
    p_planned_date: plannedDate,
    p_task_ids: orderedTaskIds,
  });
  return { updated: (data as number | null) ?? 0, error };
}

/**
 * Move a pending task to another date via RPC.
 * For recurring tasks, creates an exception so it won't regenerate.
 */
export async function moveTaskOccurrence(taskId: string, targetDate: string) {
  const { data, error } = await supabase.rpc('move_task_occurrence', {
    p_task_id: taskId,
    p_target_date: targetDate,
  });
  return { data: data as TaskOccurrence | null, error };
}

/**
 * Delete a task from its day via RPC.
 * For recurring tasks, creates a skipped exception.
 */
export async function deleteTaskOccurrenceForDay(taskId: string) {
  const { data, error } = await supabase.rpc('delete_task_occurrence_for_day', {
    p_task_id: taskId,
  });
  return { success: data as boolean | null, error };
}
