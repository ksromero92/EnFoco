/**
 * Today utilities — date/time helpers using the user's timezone.
 */

import type { DayClassification } from '@/src/types/activity';

/**
 * Returns the current date string (YYYY-MM-DD) in the given timezone.
 * Avoids UTC-based .toISOString() which can return the wrong calendar day.
 */
export function getTodayDate(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA locale produces YYYY-MM-DD format
    return formatter.format(new Date());
  } catch {
    // Fallback if timezone is invalid
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Returns the weekday number (1=Monday, 7=Sunday) for the given timezone.
 */
export function getTodayWeekday(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    });
    const dayStr = formatter.format(new Date());
    const map: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };
    return map[dayStr] ?? getFallbackWeekday();
  } catch {
    return getFallbackWeekday();
  }
}

function getFallbackWeekday(): number {
  // JS getDay(): 0=Sunday, 1=Monday ... 6=Saturday
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Formats a date string (YYYY-MM-DD) as natural Spanish.
 * e.g. "lunes, 28 de julio de 2026"
 */
export function formatDateSpanish(dateStr: string, timezone: string): string {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    const raw = date.toLocaleDateString('es-MX', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return raw.charAt(0).toLowerCase() + raw.slice(1);
  } catch {
    return dateStr;
  }
}

/**
 * Returns greeting based on current hour in the user's timezone.
 */
export function getGreeting(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  } catch {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
}

/**
 * Calculate cycle day number from start_date and today's date.
 * Both are YYYY-MM-DD strings (no time component).
 */
export function getCycleDay(startDate: string, todayDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const today = new Date(todayDate + 'T00:00:00');
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Calculate total days in a cycle from start_date to end_date.
 */
export function getCycleTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Classify the day based on completion percentage.
 */
export function classifyDay(percentage: number): DayClassification {
  if (percentage >= 80) return 'complete';
  if (percentage >= 60) return 'acceptable';
  if (percentage >= 40) return 'minimum';
  return 'lost';
}
