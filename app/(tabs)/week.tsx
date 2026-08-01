/**
 * Week screen — navigable view of the cycle's weeks with task_occurrences.
 * Supports prev/next navigation, direct week selector, and 7-day display.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
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
    getActiveCycle,
    getCategoriesByIds,
    getTasksForRange,
} from '@/src/features/tasks/task-occurrences-service';
import { getTodayDate } from '@/src/features/today/today-utils';
import type { CycleWeek } from '@/src/features/week/week-utils';
import {
    formatDayFull,
    formatWeekRange,
    getCycleWeekRanges,
    getWeekDaysForMonday,
    isDateInsideCycle
} from '@/src/features/week/week-utils';
import type { Tables } from '@/src/types/database';

type Category = Tables<'categories'>;
type Cycle = Tables<'cycles'>;

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completa', color: Palette.complete, bg: Palette.completeLight },
  partial:   { label: 'Parcial',  color: Palette.partial,  bg: Palette.partialLight },
  pending:   { label: 'Pendiente', color: Palette.pending, bg: Palette.pendingLight },
  missed:    { label: 'No realizada', color: Palette.error, bg: Palette.errorLight },
  justified: { label: 'Justificada', color: Palette.textSecondary, bg: Palette.pendingLight },
};

function getDayDotColor(tasks: TaskOccurrence[]): string | null {
  if (tasks.length === 0) return null;
  const hasCompleted = tasks.some((t) => t.status === 'completed');
  const hasMissed = tasks.some((t) => t.status === 'missed');
  const hasPartial = tasks.some((t) => t.status === 'partial');
  const allCompleted = tasks.every((t) => t.status === 'completed');
  if (allCompleted) return Palette.complete;
  if (hasMissed) return Palette.error;
  if (hasPartial || hasCompleted) return Palette.partial;
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
  const router = useRouter();
  const timezone = profile?.timezone ?? 'America/Bogota';
  const todayDate = getTodayDate(timezone);

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [allTasks, setAllTasks] = useState<TaskOccurrence[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [weekSelectorVisible, setWeekSelectorVisible] = useState(false);

  const hasMounted = useRef(false);
  const loadingRef = useRef(false);

  // Derived cycle weeks
  const weeks = useMemo(() => {
    if (!cycle) return [];
    return getCycleWeekRanges(cycle.start_date, cycle.end_date, todayDate);
  }, [cycle, todayDate]);

  const currentWeek = weeks[selectedWeekIndex] ?? null;

  const weekDays = useMemo(() => {
    if (!currentWeek || !cycle) return [];
    return getWeekDaysForMonday(currentWeek.mondayDate, cycle.start_date, cycle.end_date, todayDate);
  }, [currentWeek, cycle, todayDate]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskOccurrence[]>();
    for (const t of allTasks) {
      const arr = map.get(t.planned_date) ?? [];
      arr.push(t);
      map.set(t.planned_date, arr);
    }
    return map;
  }, [allTasks]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const selectedTasks = useMemo(() => tasksByDate.get(selectedDate) ?? [], [tasksByDate, selectedDate]);

  // Progress for selected day
  const scheduledMin = selectedTasks.reduce((s, t) => s + t.planned_minutes, 0);
  const completedMin = selectedTasks.reduce((s, t) => {
    if (t.status === 'completed') return s + t.planned_minutes;
    if (t.status === 'partial') return s + Math.min(Math.max(t.completed_minutes ?? 0, 0), t.planned_minutes);
    return s;
  }, 0);
  const pct = scheduledMin > 0 ? Math.min(100, Math.max(0, Math.round((completedMin / scheduledMin) * 100))) : 0;

  const totalCycleDays = cycle ? Math.max(1, Math.round((new Date(cycle.end_date + 'T12:00:00').getTime() - new Date(cycle.start_date + 'T12:00:00').getTime()) / 86400000) + 1) : 1;

  // ─── Load ───────────────────────────────────────────────────────────────

  const loadWeekData = useCallback(async (week: CycleWeek, options?: { silent?: boolean }) => {
    if (!user || loadingRef.current) return;
    const silent = options?.silent ?? false;
    loadingRef.current = true;
    if (!silent) setContentLoading(true);

    await ensureTaskOccurrences(week.mondayDate, week.sundayDate);

    const { data: tasks, error: taskErr } = await getTasksForRange(user.id, week.mondayDate, week.sundayDate);
    loadingRef.current = false;
    if (!silent) setContentLoading(false);
    if (taskErr) return;

    setAllTasks(tasks);
    const catIds = tasks.map((t) => t.category_id);
    const { data: cats } = await getCategoriesByIds(user.id, catIds);
    setCategories(cats);
  }, [user]);

  const loadInitial = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);

    const { data: cycleData, error: cycleErr } = await getActiveCycle(user.id);
    if (cycleErr) { setError('No se pudo cargar el ciclo.'); setLoading(false); return; }
    setCycle(cycleData);

    if (!cycleData) { setLoading(false); return; }

    const cWeeks = getCycleWeekRanges(cycleData.start_date, cycleData.end_date, todayDate);
    let initIdx = cWeeks.findIndex((w) => w.isCurrentWeek);
    let initDate = todayDate;

    if (initIdx < 0) {
      if (todayDate < cycleData.start_date) { initIdx = 0; initDate = cycleData.start_date; }
      else { initIdx = cWeeks.length - 1; initDate = cycleData.end_date; }
    }

    setSelectedWeekIndex(initIdx);
    setSelectedDate(initDate);

    const week = cWeeks[initIdx];
    if (week) {
      await ensureTaskOccurrences(week.mondayDate, week.sundayDate);
      const { data: tasks } = await getTasksForRange(user.id, week.mondayDate, week.sundayDate);
      setAllTasks(tasks ?? []);
      const catIds = (tasks ?? []).map((t) => t.category_id);
      const { data: cats } = await getCategoriesByIds(user.id, catIds);
      setCategories(cats);
    }

    setLoading(false);
  }, [user, todayDate]);

  useFocusEffect(
    useCallback(() => {
      if (hasMounted.current) {
        // Silent refresh of current week
        if (currentWeek) loadWeekData(currentWeek, { silent: true });
      } else {
        hasMounted.current = true;
        loadInitial();
      }
    }, [loadInitial, loadWeekData, currentWeek]),
  );

  // ─── Navigation handlers ───────────────────────────────────────────────

  const goToWeek = useCallback((idx: number) => {
    const w = weeks[idx];
    if (!w || !cycle) return;
    setSelectedWeekIndex(idx);
    // Select today if in this week, otherwise first cycle day in the week
    if (w.isCurrentWeek && isDateInsideCycle(todayDate, cycle.start_date, cycle.end_date)) {
      setSelectedDate(todayDate);
    } else {
      const firstValid = w.mondayDate >= cycle.start_date ? w.mondayDate : cycle.start_date;
      setSelectedDate(firstValid);
    }
    loadWeekData(w);
  }, [weeks, cycle, todayDate, loadWeekData]);

  const goPrev = useCallback(() => { if (selectedWeekIndex > 0) goToWeek(selectedWeekIndex - 1); }, [selectedWeekIndex, goToWeek]);
  const goNext = useCallback(() => { if (selectedWeekIndex < weeks.length - 1) goToWeek(selectedWeekIndex + 1); }, [selectedWeekIndex, weeks.length, goToWeek]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return <SafeAreaView style={styles.safeArea} edges={['top']}><View style={styles.centered}><ActivityIndicator size="large" color={Palette.primary} /></View></SafeAreaView>;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><Pressable onPress={loadInitial} style={styles.retryBtn}><Text style={styles.retryBtnText}>Reintentar</Text></Pressable></View>
      </SafeAreaView>
    );
  }

  if (!cycle) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No tienes un ciclo activo.</Text>
          <Pressable onPress={() => router.push('/cycles')} style={styles.retryBtn}><Text style={styles.retryBtnText}>Gestionar ciclos</Text></Pressable>
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
          {currentWeek && <Text style={styles.subtitle}>{formatWeekRange(currentWeek.mondayDate, currentWeek.sundayDate)}</Text>}
        </View>

        {/* Week navigation */}
        {currentWeek && (
          <View style={styles.navRow}>
            <Pressable onPress={goPrev} disabled={selectedWeekIndex === 0} style={[styles.navBtn, selectedWeekIndex === 0 && styles.navBtnDisabled]} accessibilityLabel="Ir a la semana anterior">
              <MaterialIcons name="chevron-left" size={24} color={selectedWeekIndex === 0 ? Palette.border : Palette.primary} />
            </Pressable>
            <Pressable onPress={() => setWeekSelectorVisible(true)} style={styles.navCenter} accessibilityLabel="Seleccionar otra semana">
              <Text style={styles.navWeekText}>Semana {currentWeek.weekNumber} de {weeks.length}</Text>
              <Text style={styles.navDaysText}>Días {currentWeek.cycleDayFrom}–{currentWeek.cycleDayTo} de {totalCycleDays}</Text>
            </Pressable>
            <Pressable onPress={goNext} disabled={selectedWeekIndex === weeks.length - 1} style={[styles.navBtn, selectedWeekIndex === weeks.length - 1 && styles.navBtnDisabled]} accessibilityLabel="Ir a la semana siguiente">
              <MaterialIcons name="chevron-right" size={24} color={selectedWeekIndex === weeks.length - 1 ? Palette.border : Palette.primary} />
            </Pressable>
          </View>
        )}

        {/* 7-day selector */}
        <View style={styles.daySelector}>
          {weekDays.map((day) => {
            const dayTasks = tasksByDate.get(day.date) ?? [];
            const dotColor = day.insideCycle ? getDayDotColor(dayTasks) : null;
            const isSelected = day.date === selectedDate;
            const disabled = !day.insideCycle;

            return (
              <Pressable
                key={day.date}
                onPress={() => !disabled && setSelectedDate(day.date)}
                disabled={disabled}
                style={[styles.dayCell, isSelected && styles.dayCellSelected, day.isToday && !isSelected && styles.dayCellToday, disabled && styles.dayCellDisabled]}
                accessibilityLabel={`${day.label} ${day.dayNumber}`}
              >
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected, disabled && styles.dayLabelDisabled]}>{day.label}</Text>
                <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected, disabled && styles.dayLabelDisabled]}>{day.dayNumber}</Text>
                {dotColor && <View style={[styles.dayDot, { backgroundColor: dotColor }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* Content loading */}
        {contentLoading && <ActivityIndicator size="small" color={Palette.primary} style={{ marginVertical: Spacing.sm }} />}

        {/* Selected day header */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderTitle}>{formatDayFull(selectedDate)}</Text>
          {selectedTasks.length > 0 && (
            <View style={styles.dayProgress}>
              <Text style={styles.dayPct}>{pct}%</Text>
              <Text style={styles.dayTime}>{formatMinutes(completedMin)} / {formatMinutes(scheduledMin)}</Text>
            </View>
          )}
        </View>

        {/* Tasks */}
        {selectedTasks.length > 0 ? (
          <View style={styles.taskList}>
            {selectedTasks.map((task) => {
              const cat = catMap.get(task.category_id);
              const st = STATUS_CFG[task.status] ?? STATUS_CFG.pending;
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
                    {task.details ? <Text style={styles.detailsText} numberOfLines={2}>{task.details}</Text> : null}
                    <View style={styles.taskMeta}>
                      {cat && <Text style={styles.metaText}>{cat.name}</Text>}
                      {task.start_time && <Text style={styles.metaText}>{task.start_time.slice(0, 5)}</Text>}
                      <Text style={styles.metaText}>{task.planned_minutes} min</Text>
                      {task.status === 'partial' && task.completed_minutes != null && <Text style={styles.metaText}>{task.completed_minutes}/{task.planned_minutes}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}><Text style={styles.emptyBody}>No tienes tareas programadas para este día.</Text></View>
        )}
      </ScrollView>

      {/* Week selector modal */}
      {weekSelectorVisible && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetPanel}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Ir a otra semana del ciclo</Text>
                <Pressable onPress={() => setWeekSelectorVisible(false)}><Text style={styles.sheetClose}>Cerrar</Text></Pressable>
              </View>
              <Text style={styles.sheetSubtitle}>{cycle.name} · {totalCycleDays} días</Text>
              <FlatList
                data={weeks}
                keyExtractor={(w) => String(w.index)}
                renderItem={({ item: w }) => (
                  <Pressable onPress={() => { goToWeek(w.index); setWeekSelectorVisible(false); }} style={[styles.weekOption, w.index === selectedWeekIndex && styles.weekOptionSelected]}>
                    <View style={styles.weekOptionContent}>
                      <Text style={[styles.weekOptionTitle, w.index === selectedWeekIndex && styles.weekOptionTitleSelected]}>Semana {w.weekNumber}{w.isCurrentWeek ? ' · Actual' : ''}</Text>
                      <Text style={styles.weekOptionMeta}>Días {w.cycleDayFrom}–{w.cycleDayTo} · {formatWeekRange(w.mondayDate, w.sundayDate)}</Text>
                    </View>
                    {w.index === selectedWeekIndex && <MaterialIcons name="check-circle" size={20} color={Palette.primary} />}
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl, maxWidth: Platform.OS === 'web' ? 680 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  header: { gap: 4, paddingTop: Spacing.sm },
  logo: { fontSize: 22, fontWeight: '800', color: Palette.primary, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.xs },
  subtitle: { fontSize: 14, color: Palette.textSecondary },
  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: { height: 40, paddingHorizontal: Spacing.lg, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center' },

  // Navigation
  navRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.xs, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.4 },
  navCenter: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs },
  navWeekText: { fontSize: 15, fontWeight: '700', color: Palette.primary },
  navDaysText: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },

  // Day selector
  daySelector: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.xs, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.sm, gap: 2 },
  dayCellSelected: { backgroundColor: Palette.primary },
  dayCellToday: { backgroundColor: Palette.primaryLight },
  dayCellDisabled: { opacity: 0.35 },
  dayLabel: { fontSize: 11, fontWeight: '600', color: Palette.textSecondary },
  dayLabelSelected: { color: Palette.textOnPrimary },
  dayLabelDisabled: { color: Palette.textSecondary },
  dayNumber: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  dayNumberSelected: { color: Palette.textOnPrimary },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },

  // Day header
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayHeaderTitle: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary, textTransform: 'capitalize' },
  dayProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dayPct: { fontSize: 15, fontWeight: '700', color: Palette.primary },
  dayTime: { fontSize: 12, color: Palette.textSecondary },

  // Task list
  taskList: { gap: Spacing.sm },
  taskRow: { flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  stripe: { width: 4 },
  taskContent: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, gap: 4, minWidth: 0 },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  detailsText: { fontSize: 13, color: Palette.textSecondary, lineHeight: 18 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: Palette.textSecondary },

  // Week selector sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetPanel: { backgroundColor: Palette.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '70%', paddingBottom: Spacing.xl },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  sheetClose: { fontSize: 15, color: Palette.primary, fontWeight: '500' },
  sheetSubtitle: { fontSize: 13, color: Palette.textSecondary, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  weekOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Palette.divider },
  weekOptionSelected: { backgroundColor: Palette.primaryLight, borderLeftWidth: 3, borderLeftColor: Palette.primary },
  weekOptionContent: { flex: 1 },
  weekOptionTitle: { fontSize: 14, fontWeight: '600', color: Palette.textPrimary },
  weekOptionTitleSelected: { color: Palette.primary },
  weekOptionMeta: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
});
