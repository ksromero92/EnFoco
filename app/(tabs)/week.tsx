/**
 * Week screen — navigable view of the cycle's weeks with task_occurrences.
 * Supports prev/next navigation, direct week selector, and 7-day display.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { CategoryIcon } from '@/src/components/categories/CategoryIcon';
import { DurationPickerField } from '@/src/components/forms/DurationPickerField';
import { TimePickerField } from '@/src/components/forms/TimePickerField';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useProfile } from '@/src/features/profile/ProfileProvider';
import type { TaskOccurrence } from '@/src/features/tasks/task-occurrences-service';
import {
  createTaskOccurrence,
  deleteTaskOccurrenceForDay,
  ensureTaskOccurrences,
  getActiveActivitiesForCycle,
  getActiveCategories,
  getActiveCycle,
  getCategoriesByIds,
  getMaxPosition,
  getTasksForRange,
  moveTaskOccurrence,
  updateTaskOccurrence
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
type Activity = Tables<'activities'>;

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

  // CRUD state
  const [actionTask, setActionTask] = useState<TaskOccurrence | null>(null);
  const [createMode, setCreateMode] = useState<'choose' | 'routine' | 'oneoff' | null>(null);
  const [editingTask, setEditingTask] = useState<TaskOccurrence | null>(null);
  const [duplicatingTask, setDuplicatingTask] = useState<TaskOccurrence | null>(null);
  const [moveTask, setMoveTask] = useState<TaskOccurrence | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskOccurrence | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // ─── CRUD handlers ─────────────────────────────────────────────────────

  const reloadWeek = useCallback(async () => {
    if (currentWeek) await loadWeekData(currentWeek, { silent: true });
  }, [currentWeek, loadWeekData]);

  const handleMove = useCallback(async (targetDate: string) => {
    if (!moveTask) return;
    const { error: err } = await moveTaskOccurrence(moveTask.id, targetDate);
    if (err) return;
    setMoveTask(null);
    await reloadWeek();
  }, [moveTask, reloadWeek]);

  const handleDelete = useCallback(async () => {
    if (!deleteTask || deleting) return;
    setDeleting(true);
    await deleteTaskOccurrenceForDay(deleteTask.id);
    setDeleting(false);
    setDeleteTask(null);
    await reloadWeek();
  }, [deleteTask, deleting, reloadWeek]);

  const handleCreateSaved = useCallback(async () => {
    setCreateMode(null);
    await reloadWeek();
  }, [reloadWeek]);

  const handleEditSaved = useCallback(async () => {
    setEditingTask(null);
    setDuplicatingTask(null);
    await reloadWeek();
  }, [reloadWeek]);

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
          <View>
            <Text style={styles.dayHeaderTitle}>{formatDayFull(selectedDate)}</Text>
            {selectedTasks.length > 0 && <Text style={styles.dayTaskCount}>{selectedTasks.length} tarea{selectedTasks.length > 1 ? 's' : ''}</Text>}
          </View>
          <Pressable onPress={() => setCreateMode('choose')} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Agregar tarea">
            <Text style={styles.addBtnText}>+ Agregar</Text>
          </Pressable>
        </View>
        {selectedTasks.length > 0 && (
          <View style={styles.dayProgressBar}>
            <Text style={styles.dayPct}>{pct}%</Text>
            <Text style={styles.dayTime}>{formatMinutes(completedMin)} / {formatMinutes(scheduledMin)}</Text>
          </View>
        )}

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
                      <Pressable onPress={() => setActionTask(task)} style={styles.moreBtn} accessibilityLabel="Abrir acciones de la tarea" accessibilityRole="button">
                        <MaterialIcons name="more-horiz" size={20} color={Palette.textSecondary} />
                      </Pressable>
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

      {/* Action menu */}
      {actionTask && (
        <Modal visible animationType="fade" transparent>
          <Pressable style={styles.sheetOverlay} onPress={() => setActionTask(null)}>
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>{actionTask.title}</Text>
              <Pressable onPress={() => { setEditingTask(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Editar</Text></Pressable>
              <Pressable onPress={() => { setDuplicatingTask(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Duplicar</Text></Pressable>
              <Pressable onPress={() => { if (actionTask.status !== 'pending') return; setMoveTask(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Mover a otro día</Text></Pressable>
              <Pressable onPress={() => { setDeleteTask(actionTask); setActionTask(null); }} style={[styles.actionBtn, styles.actionBtnDanger]}><Text style={styles.actionBtnDangerText}>Eliminar del día</Text></Pressable>
              <Pressable onPress={() => setActionTask(null)} style={styles.actionBtn}><Text style={[styles.actionBtnText, { color: Palette.textSecondary }]}>Cancelar</Text></Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteTask && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.sheetOverlay}>
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Eliminar del día</Text>
              <Text style={styles.deleteMsg}>{deleteTask.schedule_id ? 'Esta tarea se eliminará únicamente de este día.' : 'Esta tarea se eliminará de tu agenda.'}</Text>
              <View style={styles.deleteActions}>
                <Pressable onPress={() => setDeleteTask(null)} style={styles.actionBtn}><Text style={styles.actionBtnText}>Cancelar</Text></Pressable>
                <Pressable onPress={handleDelete} disabled={deleting} style={[styles.actionBtn, styles.actionBtnDanger]}><Text style={styles.actionBtnDangerText}>{deleting ? '...' : 'Eliminar'}</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Move */}
      {moveTask && <WeekMoveModal task={moveTask} cycle={cycle} onClose={() => setMoveTask(null)} onMove={handleMove} />}

      {/* Create */}
      {createMode === 'choose' && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.sheetOverlay}>
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Agregar tarea</Text>
              <Pressable onPress={() => setCreateMode('routine')} style={styles.actionBtn}><Text style={styles.actionBtnText}>Desde una rutina</Text></Pressable>
              <Pressable onPress={() => setCreateMode('oneoff')} style={styles.actionBtn}><Text style={styles.actionBtnText}>Tarea puntual</Text></Pressable>
              <Pressable onPress={() => setCreateMode(null)} style={styles.actionBtn}><Text style={[styles.actionBtnText, { color: Palette.textSecondary }]}>Cancelar</Text></Pressable>
            </View>
          </View>
        </Modal>
      )}
      {createMode === 'routine' && <WeekCreateRoutineModal userId={user?.id ?? ''} cycleId={cycle?.id ?? ''} cycleStart={cycle?.start_date ?? ''} cycleEnd={cycle?.end_date ?? ''} initialDate={selectedDate} onClose={() => setCreateMode(null)} onSaved={handleCreateSaved} />}
      {createMode === 'oneoff' && <WeekCreateOneOffModal userId={user?.id ?? ''} cycleId={cycle?.id ?? ''} cycleStart={cycle?.start_date ?? ''} cycleEnd={cycle?.end_date ?? ''} initialDate={selectedDate} onClose={() => setCreateMode(null)} onSaved={handleCreateSaved} />}

      {/* Edit / Duplicate */}
      {(editingTask || duplicatingTask) && <WeekEditModal userId={user?.id ?? ''} task={(editingTask ?? duplicatingTask)!} isDuplicate={duplicatingTask !== null} cycleId={cycle?.id ?? ''} onClose={() => { setEditingTask(null); setDuplicatingTask(null); }} onSaved={handleEditSaved} />}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sub-modals (lightweight, reusing services from task-occurrences-service)
// ---------------------------------------------------------------------------

function WeekMoveModal({ task, cycle, onClose, onMove }: { task: TaskOccurrence; cycle: Cycle | null; onClose: () => void; onMove: (d: string) => void }) {
  const [y, setY] = useState(() => parseInt(task.planned_date.slice(0, 4), 10));
  const [m, setM] = useState(() => parseInt(task.planned_date.slice(5, 7), 10));
  const [d, setD] = useState(() => parseInt(task.planned_date.slice(8, 10), 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxD = new Date(y, m, 0).getDate();
  const ed = Math.min(d, maxD);
  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;

  const handleConfirm = useCallback(() => {
    if (saving) return;
    if (task.status !== 'pending') { setError('Solo puedes mover tareas pendientes.'); return; }
    if (dateStr === task.planned_date) { setError('Selecciona una fecha diferente.'); return; }
    if (cycle && (dateStr < cycle.start_date || dateStr > cycle.end_date)) { setError('La fecha debe estar dentro del ciclo.'); return; }
    setSaving(true); onMove(dateStr);
  }, [saving, dateStr, task, cycle, onMove]);

  const years = cycle ? [...new Set([parseInt(cycle.start_date.slice(0, 4), 10), parseInt(cycle.end_date.slice(0, 4), 10)])] : [y];
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}><Text style={styles.formTitle}>Mover a otro día</Text><Pressable onPress={onClose}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
          <Text style={styles.moveWarning}>Esta tarea se moverá únicamente para esta ocasión. La rutina original no cambiará.</Text>
          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
          <View style={styles.dateRow}><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={y} onValueChange={(v) => setY(Number(v))} style={styles.pickerInner}>{years.map((yr) => <Picker.Item key={yr} label={String(yr)} value={yr} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={m} onValueChange={(v) => setM(Number(v))} style={styles.pickerInner}>{Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => <Picker.Item key={mo} label={String(mo).padStart(2, '0')} value={mo} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={ed} onValueChange={(v) => setD(Number(v))} style={styles.pickerInner}>{Array.from({ length: maxD }, (_, i) => i + 1).map((da) => <Picker.Item key={da} label={String(da).padStart(2, '0')} value={da} />)}</Picker></View></View></View>
          <Pressable onPress={handleConfirm} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}><Text style={styles.saveBtnText}>{saving ? 'Moviendo...' : 'Mover tarea'}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function WeekCreateRoutineModal({ userId, cycleId, cycleStart, cycleEnd, initialDate, onClose, onSaved }: { userId: string; cycleId: string; cycleStart: string; cycleEnd: string; initialDate: string; onClose: () => void; onSaved: () => void }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedAct, setSelectedAct] = useState<Activity | null>(null);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState(initialDate);
  const [loadingActs, setLoadingActs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { (async () => { const { data } = await getActiveActivitiesForCycle(userId, cycleId); setActivities(data); setLoadingActs(false); })(); }, [userId, cycleId]);

  const handleSave = useCallback(async () => {
    if (!selectedAct || saving) return;
    const trimmed = title.trim();
    if (!trimmed) { setError('El título es obligatorio.'); return; }
    setSaving(true); setError(null);
    const maxPos = await getMaxPosition(userId, plannedDate);
    const { error: err } = await createTaskOccurrence({ user_id: userId, cycle_id: cycleId, activity_id: selectedAct.id, schedule_id: null, category_id: selectedAct.category_id, title: trimmed, details: details.trim() || null, planned_date: plannedDate, planned_minutes: duration, start_time: startTime, tracking_type: selectedAct.tracking_type, target_value: selectedAct.target_value, unit: selectedAct.unit, weight: selectedAct.weight, source: 'manual', status: 'pending', completed_value: null, completed_minutes: null, note: null, position: maxPos + 1000 });
    setSaving(false);
    if (err) { setError('No se pudo crear.'); return; }
    onSaved();
  }, [selectedAct, title, details, duration, startTime, plannedDate, userId, cycleId, saving, onSaved]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}><Text style={styles.formTitle}>Desde una rutina</Text><Pressable onPress={onClose}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
          {loadingActs && <ActivityIndicator size="small" color={Palette.primary} />}
          {!loadingActs && !selectedAct && activities.map((a) => (<Pressable key={a.id} onPress={() => { setSelectedAct(a); setTitle(a.name); setDetails(a.description ?? ''); setDuration(a.default_duration_minutes ?? 30); }} style={styles.routineItem}><Text style={styles.routineItemText}>{a.name}</Text></Pressable>))}
          {selectedAct && (<>
            <View style={styles.fieldGroup}><Text style={styles.label}>Título</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} editable={!saving} /></View>
            <View style={styles.fieldGroup}><Text style={styles.label}>Detalle</Text><TextInput style={styles.input} value={details} onChangeText={setDetails} editable={!saving} /></View>
            <View style={styles.fieldGroup}><Text style={styles.label}>Duración</Text><DurationPickerField value={duration} onChange={setDuration} disabled={saving} /></View>
            <View style={styles.fieldGroup}><Text style={styles.label}>Hora</Text><TimePickerField value={startTime} onChange={setStartTime} disabled={saving} /></View>
            <View style={styles.fieldGroup}><Text style={styles.label}>Fecha</Text><View style={styles.dateRow}><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(0, 4), 10)} onValueChange={(v) => { const nd = `${v}-${plannedDate.slice(5)}`; if (nd >= initialDate && nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{[...new Set([parseInt(cycleStart.slice(0, 4), 10), parseInt(cycleEnd.slice(0, 4), 10)])].map((yr) => <Picker.Item key={yr} label={String(yr)} value={yr} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(5, 7), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 5)}${String(v).padStart(2, '0')}-${plannedDate.slice(8)}`; if (nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => <Picker.Item key={mo} label={String(mo).padStart(2, '0')} value={mo} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(8, 10), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 8)}${String(v).padStart(2, '0')}`; if (nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 31 }, (_, i) => i + 1).map((da) => <Picker.Item key={da} label={String(da).padStart(2, '0')} value={da} />)}</Picker></View></View></View></View>
            <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}><Text style={styles.saveBtnText}>{saving ? '...' : 'Guardar'}</Text></Pressable>
          </>)}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function WeekCreateOneOffModal({ userId, cycleId, cycleStart, cycleEnd, initialDate, onClose, onSaved }: { userId: string; cycleId: string; cycleStart: string; cycleEnd: string; initialDate: string; onClose: () => void; onSaved: () => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [trackingType, setTrackingType] = useState<'boolean' | 'minutes'>('boolean');
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { (async () => { const { data } = await getActiveCategories(userId); setCats(data); if (data.length > 0) setCategoryId(data[0]!.id); })(); }, [userId]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) { setError('El título es obligatorio.'); return; }
    if (!categoryId) { setError('Selecciona una categoría.'); return; }
    setSaving(true); setError(null);
    const maxPos = await getMaxPosition(userId, plannedDate);
    const { error: err } = await createTaskOccurrence({ user_id: userId, cycle_id: cycleId, activity_id: null, schedule_id: null, category_id: categoryId, title: trimmed, details: details.trim() || null, planned_date: plannedDate, planned_minutes: duration, start_time: startTime, tracking_type: trackingType, target_value: trackingType === 'minutes' ? duration : null, unit: trackingType === 'minutes' ? 'min' : null, weight: 1, source: 'one_off', status: 'pending', completed_value: null, completed_minutes: null, note: null, position: maxPos + 1000 });
    setSaving(false);
    if (err) { setError('No se pudo crear.'); return; }
    onSaved();
  }, [title, details, categoryId, trackingType, duration, startTime, plannedDate, userId, cycleId, saving, onSaved]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}><Text style={styles.formTitle}>Tarea puntual</Text><Pressable onPress={onClose}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
          <View style={styles.fieldGroup}><Text style={styles.label}>Título</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nombre" placeholderTextColor={Palette.textSecondary} editable={!saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Detalle</Text><TextInput style={styles.input} value={details} onChangeText={setDetails} editable={!saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Categoría</Text><View style={styles.chipRow}>{cats.map((c) => (<Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.chip, categoryId === c.id && styles.chipSelected]}><CategoryIcon icon={c.icon} color={c.color} size={20} /><Text style={[styles.chipText, categoryId === c.id && styles.chipTextSelected]}>{c.name}</Text></Pressable>))}</View></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Seguimiento</Text><View style={styles.chipRow}><Pressable onPress={() => setTrackingType('boolean')} style={[styles.chip, trackingType === 'boolean' && styles.chipSelected]}><Text style={[styles.chipText, trackingType === 'boolean' && styles.chipTextSelected]}>Confirmación</Text></Pressable><Pressable onPress={() => setTrackingType('minutes')} style={[styles.chip, trackingType === 'minutes' && styles.chipSelected]}><Text style={[styles.chipText, trackingType === 'minutes' && styles.chipTextSelected]}>Minutos</Text></Pressable></View></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Duración</Text><DurationPickerField value={duration} onChange={setDuration} disabled={saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Hora</Text><TimePickerField value={startTime} onChange={setStartTime} disabled={saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Fecha</Text><View style={styles.dateRow}><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(0, 4), 10)} onValueChange={(v) => { const nd = `${v}-${plannedDate.slice(5)}`; if (nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{[...new Set([parseInt(cycleStart.slice(0, 4), 10), parseInt(cycleEnd.slice(0, 4), 10)])].map((yr) => <Picker.Item key={yr} label={String(yr)} value={yr} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(5, 7), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 5)}${String(v).padStart(2, '0')}-${plannedDate.slice(8)}`; if (nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => <Picker.Item key={mo} label={String(mo).padStart(2, '0')} value={mo} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(8, 10), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 8)}${String(v).padStart(2, '0')}`; if (nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 31 }, (_, i) => i + 1).map((da) => <Picker.Item key={da} label={String(da).padStart(2, '0')} value={da} />)}</Picker></View></View></View></View>
          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}><Text style={styles.saveBtnText}>{saving ? '...' : 'Guardar'}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function WeekEditModal({ userId, task, isDuplicate, cycleId, onClose, onSaved }: { userId: string; task: TaskOccurrence; isDuplicate: boolean; cycleId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [details, setDetails] = useState(task.details ?? '');
  const [duration, setDuration] = useState(task.planned_minutes);
  const [startTime, setStartTime] = useState<string | null>(task.start_time?.slice(0, 5) ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) { setError('El título es obligatorio.'); return; }
    setSaving(true); setError(null);
    if (isDuplicate) {
      const maxPos = await getMaxPosition(userId, task.planned_date);
      const { error: err } = await createTaskOccurrence({ user_id: userId, cycle_id: cycleId, activity_id: task.activity_id, schedule_id: null, category_id: task.category_id, title: trimmed, details: details.trim() || null, planned_date: task.planned_date, planned_minutes: duration, start_time: startTime, tracking_type: task.tracking_type, target_value: task.target_value, unit: task.unit, weight: task.weight, source: task.source === 'one_off' ? 'one_off' : 'manual', status: 'pending', completed_value: null, completed_minutes: null, note: null, position: maxPos + 1000 });
      setSaving(false);
      if (err) { setError('No se pudo duplicar.'); return; }
    } else {
      const { error: err } = await updateTaskOccurrence(userId, task.id, { title: trimmed, details: details.trim() || null, planned_minutes: duration, start_time: startTime });
      setSaving(false);
      if (err) { setError('No se pudo guardar.'); return; }
    }
    onSaved();
  }, [title, details, duration, startTime, userId, task, isDuplicate, cycleId, saving, onSaved]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}><Text style={styles.formTitle}>{isDuplicate ? 'Duplicar tarea' : 'Editar tarea'}</Text><Pressable onPress={onClose}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
          <View style={styles.fieldGroup}><Text style={styles.label}>Título</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} editable={!saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Detalle</Text><TextInput style={styles.input} value={details} onChangeText={setDetails} editable={!saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Duración</Text><DurationPickerField value={duration} onChange={setDuration} disabled={saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Hora</Text><TimePickerField value={startTime} onChange={setStartTime} disabled={saving} /></View>
          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}><Text style={styles.saveBtnText}>{saving ? '...' : isDuplicate ? 'Duplicar' : 'Guardar'}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

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

  // Interactive additions
  moreBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtn: { height: 36, paddingHorizontal: Spacing.md, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 13, fontWeight: '600', color: Palette.textOnPrimary },
  dayTaskCount: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
  dayProgressBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actionCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 320, gap: Spacing.sm, alignItems: 'center', alignSelf: 'center' },
  actionTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary, marginBottom: Spacing.xs },
  actionBtn: { width: '100%', height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  actionBtnText: { fontSize: 15, fontWeight: '500', color: Palette.textPrimary },
  actionBtnDanger: { borderColor: Palette.errorLight, backgroundColor: Palette.errorLight },
  actionBtnDangerText: { fontSize: 15, fontWeight: '500', color: Palette.error },
  deleteMsg: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
  deleteActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  formScroll: { padding: Spacing.lg, gap: Spacing.md, maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined, paddingBottom: Spacing.xxl },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { fontSize: 20, fontWeight: '700', color: Palette.textPrimary },
  formCancel: { fontSize: 15, color: Palette.primary, fontWeight: '500' },
  moveWarning: { fontSize: 13, color: Palette.textSecondary, lineHeight: 18, textAlign: 'center', paddingVertical: Spacing.sm },
  errorBox: { backgroundColor: Palette.errorLight, borderRadius: Radius.sm, padding: Spacing.sm },
  errorBoxText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '500', color: Palette.textPrimary },
  input: { height: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 16, color: Palette.textPrimary, backgroundColor: Palette.surface },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateCol: { flex: 1 },
  pickerContainer: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, backgroundColor: Palette.surface, overflow: 'hidden' },
  pickerInner: { height: 48 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  chipSelected: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  chipText: { fontSize: 13, color: Palette.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: Palette.primary },
  routineItem: { backgroundColor: Palette.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Palette.border, marginBottom: Spacing.sm },
  routineItemText: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  saveBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  saveBtnPressed: { backgroundColor: Palette.primaryDark },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },
});
