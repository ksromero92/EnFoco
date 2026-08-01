/**
 * Week utilities — date calculations for weekly navigation within a cycle.
 */

import { getTodayDate } from '@/src/features/today/today-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeekDay {
  date: string;       // YYYY-MM-DD
  weekday: number;    // 1=Mon, 7=Sun
  label: string;      // lun, mar, ...
  dayNumber: number;  // day of month
  isToday: boolean;
  insideCycle: boolean;
}

export interface CycleWeek {
  index: number;
  weekNumber: number;       // 1-based
  mondayDate: string;
  sundayDate: string;
  cycleDayFrom: number;     // first cycle-day in this week (clamped)
  cycleDayTo: number;       // last cycle-day in this week (clamped)
  isCurrentWeek: boolean;
}

const DAY_LABELS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;
const MS_DAY = 86400000;

// ---------------------------------------------------------------------------
// Date helpers (no UTC conversion — uses T12:00:00 trick)
// ---------------------------------------------------------------------------

/** Add days to a YYYY-MM-DD string. Returns YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return formatYMD(d);
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get the Monday (start of ISO week) for any date string. */
export function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, offset);
}

/** Get Sunday for any date string. */
export function getSunday(dateStr: string): string {
  return addDays(getMonday(dateStr), 6);
}

/** Difference in days between two YYYY-MM-DD strings (b - a). */
export function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / MS_DAY);
}

/** Check if date is inside [start, end] inclusive. */
export function isDateInsideCycle(date: string, cycleStart: string, cycleEnd: string): boolean {
  return date >= cycleStart && date <= cycleEnd;
}

/** Cycle day number (1-based) for a date. */
export function getCycleDayNumber(cycleStart: string, date: string): number {
  return Math.max(1, diffDays(cycleStart, date) + 1);
}

// ---------------------------------------------------------------------------
// Cycle weeks
// ---------------------------------------------------------------------------

/**
 * Build a list of calendar weeks (Mon–Sun) that intersect with the cycle.
 */
export function getCycleWeekRanges(cycleStart: string, cycleEnd: string, todayDate: string): CycleWeek[] {
  const firstMonday = getMonday(cycleStart);
  const lastSunday = getSunday(cycleEnd);

  const weeks: CycleWeek[] = [];
  let monday = firstMonday;
  let idx = 0;

  while (monday <= lastSunday) {
    const sunday = addDays(monday, 6);

    // Clamp cycle day range
    const weekStartInCycle = monday >= cycleStart ? monday : cycleStart;
    const weekEndInCycle = sunday <= cycleEnd ? sunday : cycleEnd;
    const cycleDayFrom = getCycleDayNumber(cycleStart, weekStartInCycle);
    const cycleDayTo = getCycleDayNumber(cycleStart, weekEndInCycle);

    const isCurrentWeek = todayDate >= monday && todayDate <= sunday;

    weeks.push({
      index: idx,
      weekNumber: idx + 1,
      mondayDate: monday,
      sundayDate: sunday,
      cycleDayFrom,
      cycleDayTo,
      isCurrentWeek,
    });

    monday = addDays(monday, 7);
    idx++;
  }

  return weeks;
}

/** Find the week index that contains a given date. */
export function getWeekIndexForDate(weeks: CycleWeek[], date: string): number {
  const idx = weeks.findIndex((w) => date >= w.mondayDate && date <= w.sundayDate);
  return idx >= 0 ? idx : 0;
}

// ---------------------------------------------------------------------------
// Week days for a specific week
// ---------------------------------------------------------------------------

/**
 * Build 7 WeekDay entries for a given Monday, marking which are inside the cycle.
 */
export function getWeekDaysForMonday(monday: string, cycleStart: string, cycleEnd: string, todayDate: string): WeekDay[] {
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(monday, i);
    const d = new Date(dateStr + 'T12:00:00');
    days.push({
      date: dateStr,
      weekday: i + 1,
      label: DAY_LABELS[i] ?? '',
      dayNumber: d.getDate(),
      isToday: dateStr === todayDate,
      insideCycle: isDateInsideCycle(dateStr, cycleStart, cycleEnd),
    });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format a week date range in Spanish, e.g. "28 jul – 3 ago 2026" */
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

/** Format a date as "miércoles, 29 de julio" */
export function formatDayFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const raw = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

// Legacy export for screens that still use this
export function getCurrentWeekDays(timezone: string): WeekDay[] {
  const todayStr = getTodayDate(timezone);
  const monday = getMonday(todayStr);
  return getWeekDaysForMonday(monday, '1900-01-01', '2100-12-31', todayStr);
}
