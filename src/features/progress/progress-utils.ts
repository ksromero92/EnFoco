/**
 * Progress utilities — calculations for the weekly progress view.
 */

import type { DayClassification } from '@/src/types/activity';

export type DayStatus = 'past' | 'today' | 'future';

export interface ProgressDay {
  date: string;
  weekday: number;
  label: string;
  dayNumber: number;
  status: DayStatus;
  scheduledMinutes: number;
  completedMinutes: number;
  percentage: number;
  classification: DayClassification | null;
  hasActivities: boolean;
}

export interface CategoryProgress {
  id: string;
  name: string;
  color: string;
  scheduledMinutes: number;
  completedMinutes: number;
  percentage: number;
}

export interface WeekSummary {
  totalScheduledMinutes: number;
  totalCompletedMinutes: number;
  percentage: number;
  daysComplete: number;
  daysAcceptable: number;
  daysMinimum: number;
  daysLost: number;
}

/**
 * Classify a day based on its completion percentage.
 */
export function classifyDay(percentage: number): DayClassification {
  if (percentage >= 80) return 'complete';
  if (percentage >= 60) return 'acceptable';
  if (percentage >= 40) return 'minimum';
  return 'lost';
}

/**
 * Compute the week summary from progress days.
 * Only includes past + today days that have activities.
 */
export function computeWeekSummary(days: ProgressDay[]): WeekSummary {
  const eligible = days.filter((d) => d.status !== 'future' && d.hasActivities);

  const totalScheduledMinutes = eligible.reduce((s, d) => s + d.scheduledMinutes, 0);
  const totalCompletedMinutes = eligible.reduce((s, d) => s + d.completedMinutes, 0);
  const percentage = totalScheduledMinutes > 0
    ? Math.min(100, Math.max(0, Math.round((totalCompletedMinutes / totalScheduledMinutes) * 100)))
    : 0;

  let daysComplete = 0;
  let daysAcceptable = 0;
  let daysMinimum = 0;
  let daysLost = 0;

  for (const d of eligible) {
    switch (d.classification) {
      case 'complete': daysComplete++; break;
      case 'acceptable': daysAcceptable++; break;
      case 'minimum': daysMinimum++; break;
      case 'lost': daysLost++; break;
    }
  }

  return { totalScheduledMinutes, totalCompletedMinutes, percentage, daysComplete, daysAcceptable, daysMinimum, daysLost };
}
