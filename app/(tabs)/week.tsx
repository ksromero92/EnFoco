/**
 * Week screen — shows the current week (Mon–Sun) from task_occurrences.
 * Read-only view; completing tasks is done from the Hoy screen.
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
import { formatWeekRange, getCurrentWeekDays } from '@/src/features/week/week-utils';
import type { Tables } from '@/src/types/database';

type Category = Tables<'categories'>;

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completa', color: Palette.complete, bg: Palette.completeLight },
  partial:   { label: 'Parcial',  color: Palette.partial,  bg: Palette.partialLight },
  pending:   { label: 'Pendiente', color: Palette.pending, bg: Palette.pendingLight },
  missed:    { label: 'No realizada', color: Palette.dayLost, bg: Palette.errorLight },
  justified: { label: 'Justificada', color: Palette.primary, bg: Palette.primaryLight },
};

const SOURCE_LABELS: Record<string, string> = {
  recurring: 'Recurrente',
  manual: 'Manual',
  one_off: 'Puntual',
};

// ---------------------------------------------------------------------------
// Day summary helper
// ---------------------------------------------------------------------------

interface DaySummary {
  scheduledMinutes: number;
  completedMinutes: number;
  percentage: number;
}

function calcDaySummary(tasks: TaskOccurrence[]): DaySummary {
  const scheduledMinutes = tasks.reduce((s, t) => s + t.planned_minutes, 0);
  const completedMinutes = tasks.reduce((s, t) => {
    if (t.status === 'completed') return s + t.planned_minutes;
    if (t.status === 'partial') return s + Math.min(Math.max(t.completed_minutes ?? 0, 0), t.planned_minutes);
    return s;
  }, 0);
  const percentage = scheduledMinutes > 0
    ? Math.min(100, Math.max(0, Math.round((completedMinutes / scheduledMinutes) * 100)))
    : 0;
  return { scheduledMinutes, completedMinutes, percentage };
}

function getDotColor(pct: number): string {
  if (pct >= 80) return Palette.complete;
  if (pct >= 60) return Palette.partial;
  if (pct >= 40) return Palette.dayMinimum;
  if (pct > 0) return Palette.dayLost;
  return Palette.pending;
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

export default function WeekScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const timezone = profile?.timezone ?? 'America/Bogota';

  const weekDays = useMemo(() => getCurrentWeekDays(timezone), [timezone]);
  const mondayDate = weekDays[0]?.date ?? '';
  const sundayDate = weekDays[6]?.date ?? '';
  const todayIndex = weekDays.findIndex((d) => d.isToday);

  const [selectedIndex, setSelectedIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
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

    // Materialise recurring tasks for the full week (idempotent)
    await ensureTaskOccurrences(mondayDate, sundayDate);

    // Fetch all tasks for the range
    const { data: tasks, error: taskErr } = await getTasksForRange(user.id, mondayDate, sundayDate);
    if (taskErr) { if (!silent) setError('No se pudieron cargar las tareas.'); if (!silent) setLoading(false); return; }
    setAllTasks(tasks);

    // Categories for display
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

  // Summaries per day (for dots)
  const daySummaries = useMemo(() =>
    weekDays.map((d) => calcDaySummary(tasksByDate.get(d.date) ?? [])),
  [weekDays, tasksByDate]);

  const selectedDay = weekDays[selectedIndex];
  const selectedTasks = selectedDay ? (tasksByDate.get(selectedDay.date) ?? []) : [];
  const selectedSummary = daySummaries[selectedIndex];

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
          <Text style={styles.title}>Semana</Text>
          <Text style={styles.subtitle}>{formatWeekRange(mondayDate, sundayDate)}</Text>
        </View>

        {/* Day selector */}
        <View style={styles.daySelector}>
          {weekDays.map((day, index) => {
            const summary = daySummaries[index];
            const isSelected = index === selectedIndex;
            return (
              <Pressable
                key={day.date}
                onPress={() => setSelectedIndex(index)}
                style={[styles.dayCell, isSelected && styles.dayCellSelected, day.isToday && !isSelected && styles.dayCellToday]}
                accessibilityLabel={`${day.label} ${day.dayNumber}`}
                accessibilityRole="button"
              >
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>{day.label}</Text>
                <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{day.dayNumber}</Text>
                {summary && summary.scheduledMinutes > 0 && (
                  <View style={[styles.dayDot, { backgroundColor: getDotColor(summary.percentage) }]} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Summary bar */}
        {selectedSummary && selectedSummary.scheduledMinutes > 0 && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryPct}>{selectedSummary.percentage}%</Text>
            <Text style={styles.summaryText}>
              {formatMinutes(selectedSummary.completedMinutes)} / {formatMinutes(selectedSummary.scheduledMinutes)}
            </Text>
          </View>
        )}

        {/* Tasks for selected day */}
        {selectedTasks.length > 0 ? (
          <View style={styles.taskList}>
            {selectedTasks.map((task) => {
              const cat = catMap.get(task.category_id);
              const st = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
              const sourceLabel = SOURCE_LABELS[task.source] ?? '';
              return (
                <View key={task.id} style={styles.taskRow}>
                  <View style={[styles.stripe, { backgroundColor: cat?.color ?? Palette.primary }]} />
                  <View style={styles.taskContent}>
                    <View style={styles.taskTop}>
                      <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                      <View style={[styles.pill, { backgroundColor: st.bg }]}>
                        <View style={[styles.dot, { backgroundColor: st.color }]} />
                        <Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    <View style={styles.taskMeta}>
                      {cat && <Text style={styles.metaText}>{cat.name}</Text>}
                      {task.start_time && <Text style={styles.metaText}>{task.start_time.slice(0, 5)}</Text>}
                      <Text style={styles.metaText}>{task.planned_minutes} min</Text>
                      {task.status === 'partial' && task.completed_minutes != null && (
                        <Text style={styles.metaText}>{task.completed_minutes}/{task.planned_minutes}</Text>
                      )}
                      {sourceLabel ? <Text style={styles.sourceText}>{sourceLabel}</Text> : null}
                    </View>
                    {task.details ? <Text style={styles.detailsText} numberOfLines={2}>{task.details}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>No tienes tareas programadas para este día.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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

  // Day selector
  daySelector: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm, gap: 2 },
  dayCellSelected: { backgroundColor: Palette.primary },
  dayCellToday: { backgroundColor: Palette.primaryLight },
  dayLabel: { fontSize: 11, fontWeight: '600', color: Palette.textSecondary, textTransform: 'capitalize' },
  dayLabelSelected: { color: Palette.textOnPrimary },
  dayNumber: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  dayNumberSelected: { color: Palette.textOnPrimary },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },

  // Summary bar
  summaryBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Palette.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  summaryPct: { fontSize: 18, fontWeight: '700', color: Palette.primary },
  summaryText: { fontSize: 13, color: Palette.textSecondary },

  // Task list
  taskList: { gap: Spacing.sm },
  taskRow: { flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  stripe: { width: 4 },
  taskContent: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, gap: 4 },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: Palette.textSecondary },
  sourceText: { fontSize: 11, color: Palette.textSecondary, fontStyle: 'italic' },
  detailsText: { fontSize: 13, color: Palette.textSecondary, lineHeight: 18 },

  // Empty
  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
});
