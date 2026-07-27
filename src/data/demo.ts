/**
 * Local demo data used by the visual prototype.
 * This file must be replaced by Supabase data fetching in a future stage.
 * No component should hardcode activities or routines outside this file.
 *
 * Minute accounting rules used here:
 *   complete  → completedMinutes = durationMinutes
 *   pending   → completedMinutes = 0
 *   partial   → completedMinutes is an explicit value < durationMinutes
 *
 * Demo percentage = sum(completedMinutes) / sum(durationMinutes) × 100
 *
 * Activities:
 *   act-1  Rutina en casa   15 min  complete → 15 realized
 *   act-2  Proyecto personal 60 min  complete → 60 realized
 *   act-3  AWS + Kiro        90 min  partial  → 45 realized  (50 %)
 *   act-4  Inglés           180 min  pending  →  0 realized
 *   act-5  Gimnasio         120 min  pending  →  0 realized
 *
 *   scheduledMinutes  = 15 + 60 + 90 + 180 + 120 = 465
 *   completedMinutes  = 15 + 60 + 45 +   0 +   0 = 120
 *   percentage        = round(120 / 465 × 100)   = 26 %  → Día perdido
 *
 * NOTE: the live recalculation in TodayScreen uses the same minute-based
 * formula, so toggling activities updates all three counters consistently.
 */

import type { Activity, DaySummary } from '@/src/types/activity';

export const DEMO_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    name: 'Rutina en casa',
    category: 'Ejercicio',
    categoryColor: '#10B981',
    startTime: '06:45',
    endTime: '07:00',
    trackingType: 'confirmation',
    countsForScore: true,
    status: 'complete',
    durationMinutes: 15,
    // complete → all minutes realized
    completedMinutes: 15,
  },
  {
    id: 'act-2',
    name: 'Proyecto personal',
    category: 'Trabajo',
    categoryColor: '#2563EB',
    startTime: '07:30',
    endTime: '08:30',
    trackingType: 'duration',
    countsForScore: true,
    status: 'complete',
    durationMinutes: 60,
    // complete → all minutes realized
    completedMinutes: 60,
  },
  {
    id: 'act-3',
    name: 'AWS + Kiro',
    category: 'Trabajo',
    categoryColor: '#2563EB',
    startTime: '08:30',
    endTime: '10:00',
    trackingType: 'duration',
    countsForScore: true,
    status: 'partial',
    durationMinutes: 90,
    // partial → explicit value less than duration
    completedMinutes: 45,
  },
  {
    id: 'act-4',
    name: 'Inglés',
    category: 'Estudio',
    categoryColor: '#8B5CF6',
    startTime: '13:30',
    endTime: '16:30',
    trackingType: 'duration',
    countsForScore: true,
    status: 'pending',
    durationMinutes: 180,
    // pending → no minutes realized
    completedMinutes: 0,
  },
  {
    id: 'act-5',
    name: 'Gimnasio',
    category: 'Ejercicio',
    categoryColor: '#10B981',
    startTime: '17:00',
    endTime: '19:00',
    trackingType: 'duration',
    countsForScore: true,
    status: 'pending',
    durationMinutes: 120,
    // pending → no minutes realized
    completedMinutes: 0,
  },
];

// Derived totals kept in sync with the activities above
const SCHEDULED = DEMO_ACTIVITIES.reduce((s, a) => s + (a.durationMinutes ?? 0), 0); // 465
const COMPLETED = DEMO_ACTIVITIES.reduce((s, a) => s + (a.completedMinutes ?? 0), 0); // 120

export const DEMO_DAY_SUMMARY: DaySummary = {
  date: new Date().toISOString().split('T')[0] ?? '',
  cycleDay: 1,
  cycleTotalDays: 90,
  // Derived at build time so the initial render is consistent before any toggle
  completionPercentage: SCHEDULED > 0 ? Math.round((COMPLETED / SCHEDULED) * 100) : 0,
  classification: 'lost', // 26 % → Día perdido
  scheduledMinutes: SCHEDULED,
  completedMinutes: COMPLETED,
  activities: DEMO_ACTIVITIES,
};

export const DEMO_USER_NAME = 'Kevin';
