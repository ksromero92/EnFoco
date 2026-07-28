/**
 * Week utilities — date calculations for the current week using user timezone.
 */

import { getTodayDate, getTodayWeekday } from '@/src/features/today/today-utils';

export interface WeekDay {
  /** YYYY-MM-DD */
  date: string;
  /** 1=Monday, 7=Sunday */
  weekday: number;
  /** Short day name in Spanish, e.g. "lun" */
  label: string;
  /** Day number in month, e.g. 28 */
  dayNumber: number;
  /** Whether this is today */
  isToday: boolean;
}

const DAY_LABELS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

/**
 * Returns the 7 days of the current week (Monday to Sunday) in the user's timezone.
 * Avoids UTC-based date math by computing offsets from today's local date.
 */
export function getCurrentWeekDays(timezone: string): WeekDay[] {
  const todayStr = getTodayDate(timezone);
  const todayWeekday = getTodayWeekday(timezone); // 1=Mon, 7=Sun

  // Parse today as a local date (noon to avoid DST edge cases)
  const todayDate = new Date(todayStr + 'T12:00:00');

  const days: WeekDay[] = [];
  for (let i = 1; i <= 7; i++) {
    const offset = i - todayWeekday; // days from today
    const date = new Date(todayDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    days.push({
      date: dateStr,
      weekday: i,
      label: DAY_LABELS[i - 1] ?? '',
      dayNumber: date.getDate(),
      isToday: dateStr === todayStr,
    });
  }

  return days;
}

/**
 * Format a week date range in Spanish, e.g. "28 jul – 3 ago 2026"
 */
export function formatWeekRange(monday: string, sunday: string): string {
  const monDate = new Date(monday + 'T12:00:00');
  const sunDate = new Date(sunday + 'T12:00:00');

  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const monDay = monDate.getDate();
  const monMonth = months[monDate.getMonth()] ?? '';
  const sunDay = sunDate.getDate();
  const sunMonth = months[sunDate.getMonth()] ?? '';
  const year = sunDate.getFullYear();

  if (monDate.getMonth() === sunDate.getMonth()) {
    return `${monDay} – ${sunDay} ${sunMonth} ${year}`;
  }
  return `${monDay} ${monMonth} – ${sunDay} ${sunMonth} ${year}`;
}
