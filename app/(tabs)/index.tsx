/**
 * Today screen — daily board powered by task_occurrences.
 * Materialises recurring tasks via RPC, shows the day's tasks, allows
 * toggling completion and manual reordering (up/down).
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { ProgressCard } from '@/src/components/today/ProgressCard';
import { VoiceButton } from '@/src/components/today/VoiceButton';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useProfile } from '@/src/features/profile/ProfileProvider';
import type { TaskOccurrence } from '@/src/features/tasks/task-occurrences-service';
import {
  ensureTaskOccurrences,
  getActiveCycle,
  getCategoriesByIds,
  getTasksForDate,
  reorderTasksForDate,
  syncToActivityLog,
  updateTaskCompletion
} from '@/src/features/tasks/task-occurrences-service';
import {
  classifyDay,
  formatDateSpanish,
  getCycleDay,
  getCycleTotalDays,
  getGreeting,
  getTodayDate,
} from '@/src/features/today/today-utils';
import type { Tables } from '@/src/types/database';

type Category = Tables<'categories'>;
type Cycle = Tables<'cycles'>;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TodayScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const timezone = profile?.timezone ?? 'America/Bogota';
  const todayDate = getTodayDate(timezone);

  const [tasks, setTasks] = useState<TaskOccurrence[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Minutes modal
  const [minutesTask, setMinutesTask] = useState<TaskOccurrence | null>(null);
  const [minutesInput, setMinutesInput] = useState('');
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [minutesSaving, setMinutesSaving] = useState(false);

  const hasMounted = useRef(false);

  // ─── Load ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);

    // Materialise today's recurring tasks (idempotent)
    await ensureTaskOccurrences(todayDate, todayDate);

    // Get cycle
    const { data: cycleData } = await getActiveCycle(user.id);
    setCycle(cycleData);

    // Get tasks
    const { data: taskData, error: taskErr } = await getTasksForDate(user.id, todayDate);
    if (taskErr) { if (!silent) setError('No se pudieron cargar las tareas.'); if (!silent) setLoading(false); return; }
    setTasks(taskData);

    // Get categories for display
    const catIds = taskData.map((t) => t.category_id);
    const { data: catData } = await getCategoriesByIds(user.id, catIds);
    setCategories(catData);

    setLoading(false);
  }, [user, todayDate]);

  useFocusEffect(
    useCallback(() => {
      if (hasMounted.current) { loadData({ silent: true }); }
      else { hasMounted.current = true; loadData(); }
    }, [loadData]),
  );

  // ─── Derived ────────────────────────────────────────────────────────────

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const scheduledMinutes = tasks.reduce((s, t) => s + t.planned_minutes, 0);
  const completedMinutes = tasks.reduce((s, t) => {
    if (t.status === 'completed') return s + t.planned_minutes;
    if (t.status === 'partial') return s + Math.min(Math.max(t.completed_minutes ?? 0, 0), t.planned_minutes);
    return s;
  }, 0);
  const pendingMinutes = scheduledMinutes - completedMinutes;
  const percentage = scheduledMinutes > 0
    ? Math.min(100, Math.max(0, Math.round((completedMinutes / scheduledMinutes) * 100)))
    : 0;
  const classification = classifyDay(percentage);

  const cycleDay = cycle ? getCycleDay(cycle.start_date, todayDate) : 1;
  const cycleTotalDays = cycle ? getCycleTotalDays(cycle.start_date, cycle.end_date) : 1;

  // ─── Completion handlers ────────────────────────────────────────────────


  const toggleBoolean = useCallback(async (task: TaskOccurrence) => {
    if (!user || savingId) return;
    setSavingId(task.id);

    const isCompleting = task.status !== 'completed';
    const input = {
      status: isCompleting ? 'completed' : 'pending',
      completed_value: isCompleting ? 1 : 0,
      completed_minutes: isCompleting ? task.planned_minutes : 0,
    };

    const { data: updated, error: err } = await updateTaskCompletion(user.id, task.id, input);
    if (err || !updated) { setSavingId(null); return; }

    setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    setSavingId(null);

    // Temporary: sync to activity_logs
    await syncToActivityLog(updated);
  }, [user, savingId]);

  const handlePress = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !user || savingId) return;

    if (task.tracking_type === 'minutes') {
      setMinutesTask(task);
      setMinutesInput(task.completed_minutes && task.completed_minutes > 0 ? String(task.completed_minutes) : '');
      setMinutesError(null);
      return;
    }

    // Boolean toggle
    toggleBoolean(task);
  }, [tasks, user, savingId, toggleBoolean]);



  const handleMinutesSave = useCallback(async () => {
    if (!user || !minutesTask || minutesSaving) return;
    setMinutesError(null);

    const value = parseInt(minutesInput, 10);
    if (isNaN(value) || value < 0) { setMinutesError('Ingresa un número válido.'); return; }
    const clamped = Math.min(value, minutesTask.planned_minutes);

    const status = clamped === 0 ? 'pending' : clamped >= minutesTask.planned_minutes ? 'completed' : 'partial';

    setMinutesSaving(true);
    const { data: updated, error: err } = await updateTaskCompletion(user.id, minutesTask.id, {
      status,
      completed_value: clamped,
      completed_minutes: clamped,
    });

    if (err || !updated) { setMinutesError('No se pudo guardar.'); setMinutesSaving(false); return; }

    setTasks((prev) => prev.map((t) => t.id === minutesTask.id ? updated : t));
    setMinutesSaving(false);
    setMinutesTask(null);

    // Temporary: sync to activity_logs
    await syncToActivityLog(updated);
  }, [user, minutesTask, minutesInput, minutesSaving]);

  // ─── Reorder handlers ──────────────────────────────────────────────────

  const handleMoveUp = useCallback(async (taskId: string) => {
    if (!user || savingId) return;
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx <= 0) return;

    // Build new order by swapping idx and idx-1
    const newOrder = tasks.map((t) => t.id);
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx]!, newOrder[idx - 1]!];

    setSavingId(taskId);
    const { error: err } = await reorderTasksForDate(todayDate, newOrder);
    if (err) { setSavingId(null); return; }

    // Apply new order locally (assign sequential positions to match)
    const reordered = newOrder
      .map((id, i) => {
        const t = tasks.find((x) => x.id === id);
        return t ? { ...t, position: (i + 1) * 1000 } : null;
      })
      .filter((t): t is TaskOccurrence => t !== null);
    setTasks(reordered);
    setSavingId(null);
  }, [user, savingId, tasks, todayDate]);

  const handleMoveDown = useCallback(async (taskId: string) => {
    if (!user || savingId) return;
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx < 0 || idx >= tasks.length - 1) return;

    // Build new order by swapping idx and idx+1
    const newOrder = tasks.map((t) => t.id);
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1]!, newOrder[idx]!];

    setSavingId(taskId);
    const { error: err } = await reorderTasksForDate(todayDate, newOrder);
    if (err) { setSavingId(null); return; }

    const reordered = newOrder
      .map((id, i) => {
        const t = tasks.find((x) => x.id === id);
        return t ? { ...t, position: (i + 1) * 1000 } : null;
      })
      .filter((t): t is TaskOccurrence => t !== null);
    setTasks(reordered);
    setSavingId(null);
  }, [user, savingId, tasks, todayDate]);

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
          <Text style={styles.greeting}>{getGreeting(timezone)}, {profile?.full_name ?? 'Usuario'}</Text>
          <Text style={styles.date}>{formatDateSpanish(todayDate, timezone)}</Text>
        </View>

        {/* Progress */}
        {tasks.length > 0 && (
          <ProgressCard
            percentage={percentage}
            classification={classification}
            cycleDay={cycleDay}
            cycleTotalDays={cycleTotalDays}
            scheduledMinutes={scheduledMinutes}
            completedMinutes={completedMinutes}
            pendingMinutes={pendingMinutes}
          />
        )}

        {/* Empty */}
        {tasks.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Sin tareas para hoy</Text>
            <Text style={styles.emptyBody}>No tienes tareas programadas para hoy.</Text>
            <Pressable onPress={() => router.push('/(tabs)/routines')} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>Ir a Rutinas</Text>
            </Pressable>
          </View>
        )}

        {/* Task list */}
        {tasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tareas del día</Text>
            <View style={styles.taskList}>
              {tasks.map((task, idx) => {
                const cat = catMap.get(task.category_id);
                const statusLabel = task.status === 'completed' ? 'Completa' : task.status === 'partial' ? 'Parcial' : 'Pendiente';
                const statusColor = task.status === 'completed' ? Palette.complete : task.status === 'partial' ? Palette.partial : Palette.pending;
                const statusBg = task.status === 'completed' ? Palette.completeLight : task.status === 'partial' ? Palette.partialLight : Palette.pendingLight;
                const isSaving = savingId === task.id;

                return (
                  <View key={task.id} style={styles.taskRow}>
                    {/* Category stripe */}
                    <View style={[styles.stripe, { backgroundColor: cat?.color ?? Palette.primary }]} />
                    <View style={styles.taskContent}>
                      <View style={styles.taskTop}>
                        <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                        {/* Status pill */}
                        <Pressable
                          onPress={() => !isSaving && handlePress(task.id)}
                          disabled={isSaving}
                          style={[styles.pill, { backgroundColor: statusBg }]}
                        >
                          {isSaving ? (
                            <ActivityIndicator size={10} color={statusColor} />
                          ) : (
                            <View style={[styles.dot, { backgroundColor: statusColor }]} />
                          )}
                          <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
                        </Pressable>
                      </View>
                      <View style={styles.taskMeta}>
                        {cat && <Text style={styles.metaText}>{cat.name}</Text>}
                        {task.start_time && <Text style={styles.metaText}>{task.start_time.slice(0, 5)}</Text>}
                        <Text style={styles.metaText}>{task.planned_minutes} min</Text>
                        {task.tracking_type === 'minutes' && task.status === 'partial' && (
                          <Text style={styles.metaText}>{task.completed_minutes}/{task.planned_minutes}</Text>
                        )}
                      </View>
                      {/* Reorder buttons */}
                      <View style={styles.orderRow}>
                        <Pressable
                          onPress={() => handleMoveUp(task.id)}
                          disabled={idx === 0 || isSaving}
                          style={[styles.orderBtn, idx === 0 && styles.orderBtnDisabled]}
                          accessibilityLabel="Subir"
                        >
                          <MaterialIcons name="keyboard-arrow-up" size={18} color={idx === 0 ? Palette.border : Palette.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleMoveDown(task.id)}
                          disabled={idx === tasks.length - 1 || isSaving}
                          style={[styles.orderBtn, idx === tasks.length - 1 && styles.orderBtnDisabled]}
                          accessibilityLabel="Bajar"
                        >
                          <MaterialIcons name="keyboard-arrow-down" size={18} color={idx === tasks.length - 1 ? Palette.border : Palette.textSecondary} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <VoiceButton />
      </ScrollView>

      {/* Minutes modal */}
      {minutesTask && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{minutesTask.title}</Text>
              <Text style={styles.modalSub}>Objetivo: {minutesTask.planned_minutes} minutos</Text>
              {minutesError && <Text style={styles.modalError}>{minutesError}</Text>}
              <TextInput
                style={styles.modalInput}
                value={minutesInput}
                onChangeText={setMinutesInput}
                placeholder="Minutos realizados"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="numeric"
                editable={!minutesSaving}
                autoFocus
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setMinutesTask(null)} disabled={minutesSaving} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={handleMinutesSave} disabled={minutesSaving} style={[styles.modalSave, minutesSaving && styles.modalSaveDisabled]}>
                  {minutesSaving ? <ActivityIndicator size="small" color={Palette.textOnPrimary} /> : <Text style={styles.modalSaveText}>Guardar</Text>}
                </Pressable>
              </View>
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
  scrollContent: { padding: Spacing.md, gap: Spacing.md, maxWidth: Platform.OS === 'web' ? 680 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined, paddingBottom: Spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  header: { gap: 4, paddingBottom: Spacing.xs },
  logo: { fontSize: 22, fontWeight: '800', color: Palette.primary, letterSpacing: -0.5 },
  greeting: { fontSize: 26, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.xs },
  date: { fontSize: 14, color: Palette.textSecondary },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Palette.textPrimary },
  taskList: { gap: Spacing.sm },

  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: { height: 40, paddingHorizontal: Spacing.lg, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },

  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center' },
  linkBtn: { height: 36, paddingHorizontal: Spacing.md, backgroundColor: Palette.primaryLight, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  linkBtnText: { fontSize: 14, fontWeight: '600', color: Palette.primary },

  // Task row
  taskRow: { flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  stripe: { width: 4 },
  taskContent: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 4 },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: Palette.textSecondary },

  // Order buttons
  orderRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 2 },
  orderBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  orderBtnDisabled: { opacity: 0.4 },

  // Minutes modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 340, gap: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Palette.textPrimary },
  modalSub: { fontSize: 14, color: Palette.textSecondary },
  modalError: { fontSize: 13, color: Palette.error },
  modalInput: { height: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 18, color: Palette.textPrimary, backgroundColor: Palette.background, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalCancel: { flex: 1, height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '500', color: Palette.textSecondary },
  modalSave: { flex: 1, height: 44, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  modalSaveDisabled: { opacity: 0.6 },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: Palette.textOnPrimary },
});
