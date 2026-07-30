/**
 * Progress screen — weekly stats from task_occurrences.
 * Read-only view: percentage, classification, category breakdown.
 */

import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useProfile } from '@/src/features/profile/ProfileProvider';
import type { TaskOccurrence } from '@/src/features/tasks/task-occurrences-service';
import {
    ensureTaskOccurrences,
    getCategoriesByIds,
    getTasksForRange,
} from '@/src/features/tasks/task-occurrences-service';
import { getTodayDate } from '@/src/features/today/today-utils';
import { formatWeekRange, getCurrentWeekDays } from '@/src/features/week/week-utils';
import type { Tables } from '@/src/types/database';

type Category = Tables<'categories'>;
type DayClassification = 'complete' | 'acceptable' | 'minimum' | 'lost';
type DayStatus = 'past' | 'today' | 'future';

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const CLASS_CONFIG = {
  complete:   { label: 'Completo',  color: Palette.dayComplete,   bg: Palette.completeLight },
  acceptable: { label: 'Aceptable', color: Palette.dayAcceptable, bg: Palette.partialLight  },
  minimum:    { label: 'Mínimo',    color: Palette.dayMinimum,    bg: '#FFEDD5'             },
  lost:       { label: 'Perdido',   color: Palette.dayLost,       bg: Palette.errorLight    },
} as const;

function classifyDay(pct: number): DayClassification {
  if (pct >= 80) return 'complete';
  if (pct >= 60) return 'acceptable';
  if (pct >= 40) return 'minimum';
  return 'lost';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgressDay {
  date: string;
  label: string;
  dayNumber: number;
  status: DayStatus;
  scheduledMinutes: number;
  completedMinutes: number;
  percentage: number;
  classification: DayClassification | null;
  hasTasks: boolean;
}

interface CategoryProgress {
  id: string;
  name: string;
  color: string;
  scheduledMinutes: number;
  completedMinutes: number;
  percentage: number;
}

interface WeekSummary {
  totalScheduled: number;
  totalCompleted: number;
  percentage: number;
  daysComplete: number;
  daysAcceptable: number;
  daysMinimum: number;
  daysLost: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTaskMinutes(t: TaskOccurrence): number {
  if (t.status === 'completed') return t.planned_minutes;
  if (t.status === 'partial') return Math.min(Math.max(t.completed_minutes ?? 0, 0), t.planned_minutes);
  return 0;
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProgressScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const timezone = profile?.timezone ?? 'America/Bogota';

  const weekDays = useMemo(() => getCurrentWeekDays(timezone), [timezone]);
  const todayDate = getTodayDate(timezone);
  const mondayDate = weekDays[0]?.date ?? '';
  const sundayDate = weekDays[6]?.date ?? '';

  const [allTasks, setAllTasks] = useState<TaskOccurrence[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasMounted = useRef(false);

  // ─── Load ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !mondayDate || !sundayDate) return;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);

    // Materialise (idempotent)
    await ensureTaskOccurrences(mondayDate, sundayDate);

    const { data: tasks, error: taskErr } = await getTasksForRange(user.id, mondayDate, sundayDate);
    if (taskErr) { if (!silent) setError('No se pudieron cargar las tareas.'); if (!silent) setLoading(false); return; }
    setAllTasks(tasks);

    const catIds = tasks.map((t) => t.category_id);
    const { data: cats } = await getCategoriesByIds(user.id, catIds);
    setCategories(cats);

    setLoading(false);
  }, [user, mondayDate, sundayDate]);

  useFocusEffect(
    useCallback(() => {
      if (hasMounted.current) { loadData({ silent: true }); }
      else { hasMounted.current = true; loadData(); }
    }, [loadData]),
  );

  // ─── Derived ────────────────────────────────────────────────────────────

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskOccurrence[]>();
    for (const t of allTasks) {
      const arr = map.get(t.planned_date) ?? [];
      arr.push(t);
      map.set(t.planned_date, arr);
    }
    return map;
  }, [allTasks]);

  // Progress days
  const progressDays: ProgressDay[] = useMemo(() =>
    weekDays.map((day) => {
      const status: DayStatus = day.date < todayDate ? 'past' : day.date === todayDate ? 'today' : 'future';
      const dayTasks = tasksByDate.get(day.date) ?? [];
      const hasTasks = dayTasks.length > 0;

      if (status === 'future' || !hasTasks) {
        return { date: day.date, label: day.label, dayNumber: day.dayNumber, status, scheduledMinutes: 0, completedMinutes: 0, percentage: 0, classification: null, hasTasks };
      }

      const scheduledMinutes = dayTasks.reduce((s, t) => s + t.planned_minutes, 0);
      const completedMinutes = dayTasks.reduce((s, t) => s + getTaskMinutes(t), 0);
      const percentage = scheduledMinutes > 0 ? Math.min(100, Math.max(0, Math.round((completedMinutes / scheduledMinutes) * 100))) : 0;

      return { date: day.date, label: day.label, dayNumber: day.dayNumber, status, scheduledMinutes, completedMinutes, percentage, classification: classifyDay(percentage), hasTasks };
    }),
  [weekDays, todayDate, tasksByDate]);

  // Week summary (only past + today with tasks)
  const summary: WeekSummary = useMemo(() => {
    const eligible = progressDays.filter((d) => d.status !== 'future' && d.hasTasks);
    const totalScheduled = eligible.reduce((s, d) => s + d.scheduledMinutes, 0);
    const totalCompleted = eligible.reduce((s, d) => s + d.completedMinutes, 0);
    const percentage = totalScheduled > 0 ? Math.min(100, Math.max(0, Math.round((totalCompleted / totalScheduled) * 100))) : 0;

    let daysComplete = 0, daysAcceptable = 0, daysMinimum = 0, daysLost = 0;
    for (const d of eligible) {
      if (d.classification === 'complete') daysComplete++;
      else if (d.classification === 'acceptable') daysAcceptable++;
      else if (d.classification === 'minimum') daysMinimum++;
      else if (d.classification === 'lost') daysLost++;
    }

    return { totalScheduled, totalCompleted, percentage, daysComplete, daysAcceptable, daysMinimum, daysLost };
  }, [progressDays]);

  // Category progress (only past + today)
  const catProgress: CategoryProgress[] = useMemo(() => {
    const eligibleTasks = allTasks.filter((t) => {
      const status: DayStatus = t.planned_date < todayDate ? 'past' : t.planned_date === todayDate ? 'today' : 'future';
      return status !== 'future';
    });

    const stats = new Map<string, { scheduled: number; completed: number }>();
    for (const t of eligibleTasks) {
      const existing = stats.get(t.category_id) ?? { scheduled: 0, completed: 0 };
      existing.scheduled += t.planned_minutes;
      existing.completed += getTaskMinutes(t);
      stats.set(t.category_id, existing);
    }

    const result: CategoryProgress[] = [];
    for (const [catId, s] of stats) {
      if (s.scheduled === 0) continue;
      const cat = catMap.get(catId);
      if (!cat) continue;
      result.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        scheduledMinutes: s.scheduled,
        completedMinutes: s.completed,
        percentage: Math.min(100, Math.max(0, Math.round((s.completed / s.scheduled) * 100))),
      });
    }
    result.sort((a, b) => b.percentage - a.percentage);
    return result;
  }, [allTasks, todayDate, catMap]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Palette.primary} /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadData()} style={styles.retryBtn}><Text style={styles.retryBtnText}>Reintentar</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>EnFoco</Text>
          <Text style={styles.title}>Progreso</Text>
          <Text style={styles.subtitle}>{formatWeekRange(mondayDate, sundayDate)}</Text>
        </View>

        {/* Main card */}
        <View style={styles.mainCard}>
          <Text style={styles.mainPct}>{summary.percentage}%</Text>
          <Text style={styles.mainLabel}>cumplimiento semanal</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${summary.percentage}%` }]} />
          </View>
          <Text style={styles.mainTime}>{formatMinutes(summary.totalCompleted)} / {formatMinutes(summary.totalScheduled)}</Text>
        </View>

        {/* Classification counters */}
        <View style={styles.countersRow}>
          <CounterBadge label="Completos" count={summary.daysComplete} color={Palette.dayComplete} bg={Palette.completeLight} />
          <CounterBadge label="Aceptables" count={summary.daysAcceptable} color={Palette.dayAcceptable} bg={Palette.partialLight} />
          <CounterBadge label="Mínimos" count={summary.daysMinimum} color={Palette.dayMinimum} bg="#FFEDD5" />
          <CounterBadge label="Perdidos" count={summary.daysLost} color={Palette.dayLost} bg={Palette.errorLight} />
        </View>

        {/* Day breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen diario</Text>
          <View style={styles.dayList}>
            {progressDays.map((d) => <DayRow key={d.date} day={d} />)}
          </View>
        </View>

        {/* Category performance */}
        {catProgress.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rendimiento por categoría</Text>
            <View style={styles.catList}>
              {catProgress.map((c) => <CategoryRow key={c.id} category={c} />)}
            </View>
          </View>
        )}

        {summary.totalScheduled === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>No hay tareas programadas para esta semana.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CounterBadge({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <View style={[styles.counterBadge, { backgroundColor: bg }]}>
      <Text style={[styles.counterCount, { color }]}>{count}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

function DayRow({ day }: { day: ProgressDay }) {
  if (day.status === 'future') {
    return (
      <View style={styles.dayRow}>
        <Text style={styles.dayRowLabel}>{day.label}</Text>
        <Text style={styles.dayRowFuture}>Próximo</Text>
      </View>
    );
  }
  if (!day.hasTasks) {
    return (
      <View style={styles.dayRow}>
        <Text style={styles.dayRowLabel}>{day.label}</Text>
        <Text style={styles.dayRowEmpty}>Sin actividades</Text>
      </View>
    );
  }
  const config = day.classification ? CLASS_CONFIG[day.classification] : null;
  return (
    <View style={styles.dayRow}>
      <Text style={[styles.dayRowLabel, day.status === 'today' && styles.dayRowLabelToday]}>{day.label}</Text>
      <View style={styles.dayRowRight}>
        <Text style={styles.dayRowPct}>{day.percentage}%</Text>
        {config && (
          <View style={[styles.classChip, { backgroundColor: config.bg }]}>
            <Text style={[styles.classChipText, { color: config.color }]}>{config.label}</Text>
          </View>
        )}
        <Text style={styles.dayRowTime}>{formatMinutes(day.completedMinutes)}/{formatMinutes(day.scheduledMinutes)}</Text>
      </View>
    </View>
  );
}

function CategoryRow({ category }: { category: CategoryProgress }) {
  return (
    <View style={styles.catRow}>
      <View style={styles.catRowLeft}>
        <View style={[styles.catDot, { backgroundColor: category.color }]} />
        <Text style={styles.catName}>{category.name}</Text>
      </View>
      <View style={styles.catRowRight}>
        <Text style={styles.catPct}>{category.percentage}%</Text>
        <View style={styles.catBarTrack}>
          <View style={[styles.catBarFill, { width: `${category.percentage}%`, backgroundColor: category.color }]} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.background },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl,
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  header: { gap: 4, paddingTop: Spacing.sm },
  logo: { fontSize: 22, fontWeight: '800', color: Palette.primary, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.xs },
  subtitle: { fontSize: 14, color: Palette.textSecondary },

  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: { height: 40, paddingHorizontal: Spacing.lg, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },

  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

  mainCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  mainPct: { fontSize: 48, fontWeight: '700', color: Palette.textPrimary, lineHeight: 52 },
  mainLabel: { fontSize: 14, color: Palette.textSecondary },
  barTrack: { width: '100%', height: 8, backgroundColor: Palette.divider, borderRadius: Radius.full, overflow: 'hidden', marginTop: Spacing.xs },
  barFill: { height: '100%', backgroundColor: Palette.primary, borderRadius: Radius.full },
  mainTime: { fontSize: 13, color: Palette.textSecondary, marginTop: Spacing.xs },

  countersRow: { flexDirection: 'row', gap: Spacing.sm },
  counterBadge: { flex: 1, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', gap: 2 },
  counterCount: { fontSize: 20, fontWeight: '700' },
  counterLabel: { fontSize: 10, fontWeight: '600', color: Palette.textSecondary, textAlign: 'center' },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Palette.textPrimary },

  dayList: { gap: Spacing.xs },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Palette.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.03, shadowRadius: 1, elevation: 1 },
  dayRowLabel: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary, width: 36, textTransform: 'capitalize' },
  dayRowLabelToday: { color: Palette.primary },
  dayRowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dayRowPct: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary, width: 36, textAlign: 'right' },
  dayRowTime: { fontSize: 12, color: Palette.textSecondary, width: 80, textAlign: 'right' },
  dayRowFuture: { fontSize: 13, color: Palette.textSecondary, fontStyle: 'italic' },
  dayRowEmpty: { fontSize: 13, color: Palette.textSecondary },
  classChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  classChipText: { fontSize: 10, fontWeight: '600' },

  catList: { gap: Spacing.sm },
  catRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, shadowColor: '#000', shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.03, shadowRadius: 1, elevation: 1 },
  catRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontSize: 14, fontWeight: '500', color: Palette.textPrimary },
  catRowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, width: 120 },
  catPct: { fontSize: 14, fontWeight: '700', color: Palette.textPrimary, width: 36, textAlign: 'right' },
  catBarTrack: { flex: 1, height: 6, backgroundColor: Palette.divider, borderRadius: Radius.full, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: Radius.full },
});
