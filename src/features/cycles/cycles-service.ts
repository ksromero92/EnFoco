/**
 * Cycles service — queries and RPC calls for cycle management.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database';

export type Cycle = Tables<'cycles'>;

/**
 * Get all cycles for a user, ordered: active first, then completed, then archived.
 * Within each status, ordered by start_date descending.
 */
export async function getUserCycles(userId: string) {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });

  if (error) return { data: [], error };

  // Sort: active → completed → archived
  const statusOrder: Record<string, number> = { active: 0, completed: 1, archived: 2 };
  const sorted = (data ?? []).sort((a, b) => {
    const sa = statusOrder[a.status] ?? 3;
    const sb = statusOrder[b.status] ?? 3;
    if (sa !== sb) return sa - sb;
    // Same status — descending start_date (already from query, but ensure)
    return b.start_date.localeCompare(a.start_date);
  });

  return { data: sorted, error: null };
}

/**
 * Start a new cycle via RPC. Completes the current active cycle (if any)
 * and creates a new one in a single transaction on the server.
 */
export async function startNewCycle(name: string, startDate: string, durationDays: number) {
  const { data, error } = await supabase.rpc('start_new_cycle', {
    p_name: name,
    p_start_date: startDate,
    p_duration_days: durationDays,
  });

  return { data: data as Cycle | null, error };
}

/**
 * Archive a completed cycle via RPC.
 */
export async function archiveCycle(cycleId: string) {
  const { data, error } = await supabase.rpc('archive_cycle', {
    p_cycle_id: cycleId,
  });

  return { data: data as Cycle | null, error };
}
