/**
 * Shared types for activities and daily tracking.
 * These types are used across features and will align with the Supabase schema in the future.
 */

// Tracking method determines how completion is measured
export type TrackingType =
  | 'confirmation' // binary: done or not done
  | 'duration'     // minutes completed vs target
  | 'quantity'     // count completed vs target
  | 'percentage';  // manually entered percentage

// Completion state of a single activity instance
export type CompletionStatus = 'pending' | 'partial' | 'complete' | 'justified';

// Day classification thresholds are defined in src/domain (future)
export type DayClassification =
  | 'complete'    // 80–100 %
  | 'acceptable'  // 60–79.99 %
  | 'minimum'     // 40–59.99 %
  | 'lost';       // 0–39.99 %

export interface Activity {
  id: string;
  name: string;
  category: string;
  /** Display color for the category dot */
  categoryColor: string;
  /** HH:MM format, e.g. "06:45" */
  startTime: string | null;
  /** HH:MM format, e.g. "07:00" */
  endTime: string | null;
  trackingType: TrackingType;
  /** Whether this activity contributes to the daily percentage */
  countsForScore: boolean;
  status: CompletionStatus;
  /** Duration target in minutes (used with 'duration' tracking) */
  durationMinutes: number | null;
  /**
   * Minutes actually realized for this activity instance.
   * Rules for demo data:
   *   complete  → equals durationMinutes
   *   pending   → 0
   *   partial   → explicit value > 0 and < durationMinutes
   * Used by TodayScreen to compute completedMinutes and percentage.
   */
  completedMinutes: number;
}

export interface DaySummary {
  date: string;          // ISO date string YYYY-MM-DD
  cycleDay: number;
  cycleTotalDays: number;
  completionPercentage: number;
  classification: DayClassification;
  scheduledMinutes: number;
  completedMinutes: number;
  activities: Activity[];
}
