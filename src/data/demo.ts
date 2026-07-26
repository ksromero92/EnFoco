/**
 * Local demo data used by the visual prototype.
 * This file must be replaced by Supabase data fetching in a future stage.
 * No component should hardcode activities or routines outside this file.
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
  },
];

export const DEMO_DAY_SUMMARY: DaySummary = {
  date: new Date().toISOString().split('T')[0] ?? '',
  cycleDay: 1,
  cycleTotalDays: 90,
  completionPercentage: 72,
  classification: 'acceptable',
  scheduledMinutes: 465,
  completedMinutes: 165,
  activities: DEMO_ACTIVITIES,
};

export const DEMO_USER_NAME = 'Kevin';
