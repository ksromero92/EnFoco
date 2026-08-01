/**
 * Today screen — daily board powered by task_occurrences.
 * Materialises recurring tasks via RPC, shows the day's tasks, allows
 * toggling completion and manual reordering (up/down).
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
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
import Sortable from 'react-native-sortables';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { CategoryIcon } from '@/src/components/categories/CategoryIcon';
import { DurationPickerField } from '@/src/components/forms/DurationPickerField';
import { TimePickerField } from '@/src/components/forms/TimePickerField';
import { ProgressCard } from '@/src/components/today/ProgressCard';
import { VoiceButton } from '@/src/components/today/VoiceButton';
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
  getTasksForDate,
  moveTaskOccurrence,
  reorderTasksForDate,
  updateTaskCompletion,
  updateTaskOccurrence
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
type Activity = Tables<'activities'>;

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

  // Action menu + CRUD
  const [actionTask, setActionTask] = useState<TaskOccurrence | null>(null);
  const [createMode, setCreateMode] = useState<'choose' | 'routine' | 'oneoff' | null>(null);
  const [editingTask, setEditingTask] = useState<TaskOccurrence | null>(null);
  const [duplicatingTask, setDuplicatingTask] = useState<TaskOccurrence | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskOccurrence | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [moveTask, setMoveTask] = useState<TaskOccurrence | null>(null);
  const [missedTask, setMissedTask] = useState<TaskOccurrence | null>(null);
  const [justifyTask, setJustifyTask] = useState<TaskOccurrence | null>(null);
  const [justifyNote, setJustifyNote] = useState('');
  const [justifySaving, setJustifySaving] = useState(false);
  const [justifyError, setJustifyError] = useState<string | null>(null);
  const [viewJustification, setViewJustification] = useState<TaskOccurrence | null>(null);

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
  }, [user, savingId]);

  const handlePress = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !user || savingId) return;

    // Block completion for missed/justified — user must restore first
    if (task.status === 'missed' || task.status === 'justified') return;

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
  }, [user, minutesTask, minutesInput, minutesSaving]);

  // ─── Task actions ────────────────────────────────────────────────────────

  const openTaskActions = useCallback((task: TaskOccurrence) => {
    setActionTask(task);
  }, []);

  // ─── Drag-and-drop ─────────────────────────────────────────────────────

  const handleDragEnd = useCallback(async ({ data }: { data: TaskOccurrence[] }) => {
    if (savingId) return;
    const orderedIds = data.map((t) => t.id);
    const previousTasks = [...tasks];

    // Optimistic update
    setTasks(data.map((t, i) => ({ ...t, position: (i + 1) * 1000 })));
    setSavingId('reordering');

    const { error: err } = await reorderTasksForDate(todayDate, orderedIds);
    setSavingId(null);

    if (err) {
      setTasks(previousTasks);
    }
  }, [tasks, savingId, todayDate]);

  // ─── CRUD handlers ─────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!user || !deleteTask || deleting) return;
    setDeleting(true);
    const { error: err } = await deleteTaskOccurrenceForDay(deleteTask.id);
    if (err) { setDeleting(false); return; }
    setDeleteTask(null);
    setDeleting(false);
    await loadData({ silent: true });
  }, [user, deleteTask, deleting, loadData]);

  const handleMove = useCallback(async (targetDate: string) => {
    if (!moveTask) return;
    const { error: err } = await moveTaskOccurrence(moveTask.id, targetDate);
    if (err) { return; }
    setMoveTask(null);
    await loadData({ silent: true });
  }, [moveTask, loadData]);

  const handleMarkMissed = useCallback(async () => {
    if (!user || !missedTask || savingId) return;
    setSavingId(missedTask.id);
    const { error: err } = await updateTaskCompletion(user.id, missedTask.id, { status: 'missed', completed_value: 0, completed_minutes: 0 });
    setSavingId(null);
    setMissedTask(null);
    if (!err) await loadData({ silent: true });
  }, [user, missedTask, savingId, loadData]);

  const handleJustify = useCallback(async () => {
    if (!user || !justifyTask || justifySaving) return;
    const trimmed = justifyNote.trim();
    if (trimmed.length < 3) { setJustifyError('La justificación debe tener al menos 3 caracteres.'); return; }
    if (trimmed.length > 300) { setJustifyError('Máximo 300 caracteres.'); return; }
    setJustifySaving(true); setJustifyError(null);
    const { error: err } = await updateTaskOccurrence(user.id, justifyTask.id, { status: 'justified', completed_value: 0, completed_minutes: 0, note: trimmed });
    setJustifySaving(false);
    if (err) { setJustifyError('No se pudo guardar.'); return; }
    setJustifyTask(null); setJustifyNote('');
    await loadData({ silent: true });
  }, [user, justifyTask, justifyNote, justifySaving, loadData]);

  const handleRestore = useCallback(async (task: TaskOccurrence) => {
    if (!user || savingId) return;
    setSavingId(task.id);
    const { error: err } = await updateTaskOccurrence(user.id, task.id, { status: 'pending', completed_value: 0, completed_minutes: 0, note: null });
    setSavingId(null);
    if (!err) await loadData({ silent: true });
  }, [user, savingId, loadData]);

  const handleCreateSaved = useCallback(async () => {
    setCreateMode(null);
    await loadData({ silent: true });
  }, [loadData]);

  const handleEditSaved = useCallback(async () => {
    setEditingTask(null);
    setDuplicatingTask(null);
    await loadData({ silent: true });
  }, [loadData]);

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
            <View style={styles.sortableContainer}>
              <Sortable.Grid
                customHandle
                columns={1}
                data={tasks}
                keyExtractor={(item) => item.id}
                onDragEnd={handleDragEnd}
                dragActivationDelay={200}
                activeItemScale={1.02}
                activeItemOpacity={0.9}
                activeItemShadowOpacity={0.2}
                inactiveItemOpacity={0.7}
                rowGap={Spacing.sm}
                renderItem={({ item: task }) => {
                  const cat = catMap.get(task.category_id);
                  const statusLabel = task.status === 'completed' ? 'Completa' : task.status === 'partial' ? 'Parcial' : task.status === 'missed' ? 'No realizada' : task.status === 'justified' ? 'Justificada' : 'Pendiente';
                  const statusColor = task.status === 'completed' ? Palette.complete : task.status === 'partial' ? Palette.partial : task.status === 'missed' ? Palette.error : task.status === 'justified' ? Palette.textSecondary : Palette.pending;
                  const statusBg = task.status === 'completed' ? Palette.completeLight : task.status === 'partial' ? Palette.partialLight : task.status === 'missed' ? Palette.errorLight : task.status === 'justified' ? Palette.pendingLight : Palette.pendingLight;

                  return (
                    <View style={styles.taskRow}>
                      <Sortable.Handle>
                        <View style={styles.dragHandle} accessibilityLabel="Arrastrar para cambiar el orden" accessibilityRole="button">
                          <MaterialIcons name="drag-indicator" size={20} color={Palette.textSecondary} />
                        </View>
                      </Sortable.Handle>
                      <View style={[styles.stripe, { backgroundColor: cat?.color ?? Palette.primary }]} />
                      <View style={styles.taskContent}>
                        <View style={styles.taskTop}>
                          <Sortable.Touchable onTap={() => { if (savingId) return; handlePress(task.id); }} style={styles.taskTitleWrap}>
                            <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                          </Sortable.Touchable>
                          <Sortable.Touchable onTap={() => { if (savingId) return; handlePress(task.id); }} style={[styles.pill, { backgroundColor: statusBg }, savingId === task.id && styles.pillDisabled]}>
                            {savingId === task.id ? <ActivityIndicator size={10} color={statusColor} /> : <View style={[styles.dot, { backgroundColor: statusColor }]} />}
                            <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
                          </Sortable.Touchable>
                          <Sortable.Touchable onTap={() => openTaskActions(task)} style={styles.moreBtn} accessibilityLabel="Abrir acciones de la tarea" accessibilityRole="button">
                            <MaterialIcons name="more-horiz" size={20} color={Palette.textSecondary} />
                          </Sortable.Touchable>
                        </View>
                        {task.details ? <Text style={styles.detailsText} numberOfLines={2}>{task.details}</Text> : null}
                        <View style={styles.taskMeta}>
                          {cat && <Text style={styles.metaText}>{cat.name}</Text>}
                          {task.start_time && <Text style={styles.metaText}>{task.start_time.slice(0, 5)}</Text>}
                          <Text style={styles.metaText}>{task.planned_minutes} min</Text>
                          {task.tracking_type === 'minutes' && task.status === 'partial' && (
                            <Text style={styles.metaText}>{task.completed_minutes}/{task.planned_minutes}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          </View>
        )}

        {/* Add task button */}
        {cycle && (
          <Pressable onPress={() => setCreateMode('choose')} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]} accessibilityRole="button" accessibilityLabel="Agregar tarea">
            <Text style={styles.addBtnText}>+ Agregar tarea</Text>
          </Pressable>
        )}

        <VoiceButton />
      </ScrollView>

      {/* Action menu per task */}
      {actionTask && (
        <Modal visible animationType="fade" transparent>
          <Pressable style={styles.modalOverlay} onPress={() => setActionTask(null)}>
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>{actionTask.title}</Text>
              <Pressable onPress={() => { setEditingTask(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Editar</Text></Pressable>
              <Pressable onPress={() => { setDuplicatingTask(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Duplicar</Text></Pressable>
              {(actionTask.status === 'pending' || actionTask.status === 'partial') && (
                <Pressable onPress={() => { if (actionTask.status !== 'pending') { return; } setMoveTask(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Mover a otro día</Text></Pressable>
              )}
              {(actionTask.status === 'pending' || actionTask.status === 'partial') && (
                <Pressable onPress={() => { setMissedTask(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Marcar como no realizada</Text></Pressable>
              )}
              {(actionTask.status === 'pending' || actionTask.status === 'partial' || actionTask.status === 'missed') && (
                <Pressable onPress={() => { setJustifyTask(actionTask); setJustifyNote(''); setJustifyError(null); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Justificar</Text></Pressable>
              )}
              {actionTask.status === 'justified' && (
                <Pressable onPress={() => { setViewJustification(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Ver justificación</Text></Pressable>
              )}
              {(actionTask.status === 'missed' || actionTask.status === 'justified') && (
                <Pressable onPress={() => { handleRestore(actionTask); setActionTask(null); }} style={styles.actionBtn}><Text style={styles.actionBtnText}>Restablecer a pendiente</Text></Pressable>
              )}
              <Pressable onPress={() => { setDeleteTask(actionTask); setActionTask(null); }} style={[styles.actionBtn, styles.actionBtnDanger]}><Text style={styles.actionBtnDangerText}>Eliminar del día</Text></Pressable>
              <Pressable onPress={() => setActionTask(null)} style={styles.actionBtn}><Text style={[styles.actionBtnText, { color: Palette.textSecondary }]}>Cancelar</Text></Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteTask && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Eliminar tarea</Text>
              <Text style={styles.modalSub}>
                {deleteTask.schedule_id
                  ? 'Esta tarea se eliminará únicamente de este día. La rutina y sus próximas repeticiones continuarán.'
                  : 'Esta tarea se eliminará de tu agenda.'}
              </Text>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setDeleteTask(null)} disabled={deleting} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancelar</Text></Pressable>
                <Pressable onPress={handleDelete} disabled={deleting} style={[styles.modalSave, { backgroundColor: Palette.error }]}><Text style={styles.modalSaveText}>{deleting ? '...' : 'Eliminar'}</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Missed confirmation */}
      {missedTask && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>No realizada</Text>
              <Text style={styles.modalSub}>Esta tarea quedará registrada como no realizada.</Text>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setMissedTask(null)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancelar</Text></Pressable>
                <Pressable onPress={handleMarkMissed} style={styles.modalSave}><Text style={styles.modalSaveText}>Confirmar</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Justify modal */}
      {justifyTask && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.formHeader}><Text style={styles.formTitle}>Justificar tarea</Text><Pressable onPress={() => { setJustifyTask(null); setJustifyNote(''); }}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
              <Text style={styles.moveWarning}>Indica por qué esta tarea no se realizó.</Text>
              {justifyError && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{justifyError}</Text></View>}
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: Spacing.sm }]} value={justifyNote} onChangeText={setJustifyNote} placeholder="Razón de la justificación..." placeholderTextColor={Palette.textSecondary} multiline editable={!justifySaving} maxLength={300} />
              <Pressable onPress={handleJustify} disabled={justifySaving} style={({ pressed }) => [styles.saveBtn, pressed && !justifySaving && styles.saveBtnPressed, justifySaving && styles.saveBtnDisabled]}><Text style={styles.saveBtnText}>{justifySaving ? 'Guardando...' : 'Guardar justificación'}</Text></Pressable>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* View justification */}
      {viewJustification && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Justificación</Text>
              <Text style={styles.modalSub}>{viewJustification.note ?? 'Sin nota.'}</Text>
              <Pressable onPress={() => setViewJustification(null)} style={styles.modalSave}><Text style={styles.modalSaveText}>Cerrar</Text></Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Move task modal */}
      {moveTask && (
        <MoveTaskModal task={moveTask} cycle={cycle} onClose={() => setMoveTask(null)} onMove={handleMove} />
      )}

      {/* Create mode selector */}
      {createMode === 'choose' && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Agregar tarea</Text>
              <Pressable onPress={() => setCreateMode('routine')} style={styles.actionBtn}><Text style={styles.actionBtnText}>Desde una rutina</Text></Pressable>
              <Pressable onPress={() => setCreateMode('oneoff')} style={styles.actionBtn}><Text style={styles.actionBtnText}>Tarea puntual</Text></Pressable>
              <Pressable onPress={() => setCreateMode(null)} style={styles.actionBtn}><Text style={[styles.actionBtnText, { color: Palette.textSecondary }]}>Cancelar</Text></Pressable>
            </View>
          </View>
        </Modal>
      )}
      {createMode === 'routine' && (
        <CreateFromRoutineModal userId={user?.id ?? ''} cycleId={cycle?.id ?? ''} cycleStart={cycle?.start_date ?? todayDate} cycleEnd={cycle?.end_date ?? todayDate} todayDate={todayDate} onClose={() => setCreateMode(null)} onSaved={handleCreateSaved} />
      )}
      {createMode === 'oneoff' && (
        <CreateOneOffModal userId={user?.id ?? ''} cycleId={cycle?.id ?? ''} cycleStart={cycle?.start_date ?? todayDate} cycleEnd={cycle?.end_date ?? todayDate} todayDate={todayDate} onClose={() => setCreateMode(null)} onSaved={handleCreateSaved} />
      )}

      {/* Edit / Duplicate modal */}
      {(editingTask || duplicatingTask) && (
        <EditTaskModal
          userId={user?.id ?? ''}
          task={(editingTask ?? duplicatingTask)!}
          isDuplicate={duplicatingTask !== null}
          todayDate={todayDate}
          cycleId={cycle?.id ?? ''}
          onClose={() => { setEditingTask(null); setDuplicatingTask(null); }}
          onSaved={handleEditSaved}
        />
      )}

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
// MoveTaskModal
// ---------------------------------------------------------------------------

function MoveTaskModal({ task, cycle, onClose, onMove }: { task: TaskOccurrence; cycle: Cycle | null; onClose: () => void; onMove: (date: string) => void }) {
  const [year, setYear] = useState(() => parseInt(task.planned_date.slice(0, 4), 10));
  const [month, setMonth] = useState(() => parseInt(task.planned_date.slice(5, 7), 10));
  const [day, setDay] = useState(() => parseInt(task.planned_date.slice(8, 10), 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxDay = new Date(year, month, 0).getDate();
  const effectiveDay = Math.min(day, maxDay);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;

  const handleMove = useCallback(async () => {
    if (saving) return;
    if (dateStr === task.planned_date) { setError('Selecciona una fecha diferente.'); return; }
    if (cycle && (dateStr < cycle.start_date || dateStr > cycle.end_date)) { setError('La fecha debe estar dentro del ciclo.'); return; }
    setSaving(true); setError(null);
    onMove(dateStr);
  }, [saving, dateStr, task.planned_date, cycle, onMove]);

  const years = cycle ? [parseInt(cycle.start_date.slice(0, 4), 10), parseInt(cycle.end_date.slice(0, 4), 10)] : [year];
  const uniqueYears = [...new Set(years)];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}><Text style={styles.formTitle}>Mover a otro día</Text><Pressable onPress={onClose}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
          <Text style={styles.moveWarning}>Esta tarea se moverá únicamente para esta ocasión. La rutina original no cambiará.</Text>
          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
          <View style={styles.dateRow}>
            <View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={year} onValueChange={(v: number) => setYear(Number(v))} style={styles.pickerInner}>{uniqueYears.map((y) => <Picker.Item key={y} label={String(y)} value={y} />)}</Picker></View></View>
            <View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={month} onValueChange={(v: number) => setMonth(Number(v))} style={styles.pickerInner}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />)}</Picker></View></View>
            <View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={effectiveDay} onValueChange={(v: number) => setDay(Number(v))} style={styles.pickerInner}>{Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => <Picker.Item key={d} label={String(d).padStart(2, '0')} value={d} />)}</Picker></View></View>
          </View>
          <Pressable onPress={handleMove} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}><Text style={styles.saveBtnText}>{saving ? 'Moviendo...' : 'Mover'}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CreateFromRoutineModal
// ---------------------------------------------------------------------------

function CreateFromRoutineModal({ userId, cycleId, cycleStart, cycleEnd, todayDate, onClose, onSaved }: { userId: string; cycleId: string; cycleStart: string; cycleEnd: string; todayDate: string; onClose: () => void; onSaved: () => void }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedAct, setSelectedAct] = useState<Activity | null>(null);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState(todayDate);
  const [loadingActs, setLoadingActs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data } = await getActiveActivitiesForCycle(userId, cycleId);
      setActivities(data);
      setLoadingActs(false);
    })();
  }, [userId, cycleId]);

  const selectRoutine = useCallback((act: Activity) => {
    setSelectedAct(act);
    setTitle(act.name);
    setDetails(act.description ?? '');
    setDuration(act.default_duration_minutes ?? 30);
    setStartTime(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedAct || saving) return;
    const trimmed = title.trim();
    if (!trimmed) { setError('El título es obligatorio.'); return; }
    if (duration < 1 || duration > 1440) { setError('Duración inválida.'); return; }
    setSaving(true); setError(null);
    const maxPos = await getMaxPosition(userId, plannedDate);
    const { error: err } = await createTaskOccurrence({
      user_id: userId, cycle_id: cycleId, activity_id: selectedAct.id, schedule_id: null,
      category_id: selectedAct.category_id, title: trimmed, details: details.trim() || null,
      planned_date: plannedDate, planned_minutes: duration, start_time: startTime,
      tracking_type: selectedAct.tracking_type, target_value: selectedAct.target_value,
      unit: selectedAct.unit, weight: selectedAct.weight,
      source: 'manual', status: 'pending', completed_value: null, completed_minutes: null, note: null,
      position: maxPos + 1000,
    });
    setSaving(false);
    if (err) { setError('No se pudo crear la tarea.'); return; }
    onSaved();
  }, [selectedAct, title, details, duration, startTime, userId, cycleId, plannedDate, saving, onSaved]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}><Text style={styles.formTitle}>Desde una rutina</Text><Pressable onPress={onClose}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
          {loadingActs && <ActivityIndicator size="small" color={Palette.primary} />}
          {!loadingActs && !selectedAct && (
            <View style={styles.routineList}>{activities.map((a) => (
              <Pressable key={a.id} onPress={() => selectRoutine(a)} style={styles.routineItem}><Text style={styles.routineItemText}>{a.name}</Text><Text style={styles.routineItemMeta}>{a.default_duration_minutes} min</Text></Pressable>
            ))}{activities.length === 0 && <Text style={styles.emptyBody}>No hay rutinas activas.</Text>}</View>
          )}
          {selectedAct && (<>
            <View style={styles.fieldGroup}><Text style={styles.label}>Título</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} editable={!saving} /></View>
            <View style={styles.fieldGroup}><Text style={styles.label}>Detalle (opcional)</Text><TextInput style={styles.input} value={details} onChangeText={setDetails} editable={!saving} /></View>
            <View style={styles.fieldGroup}><Text style={styles.label}>Duración</Text><DurationPickerField value={duration} onChange={setDuration} disabled={saving} /></View>
            <View style={styles.fieldGroup}><Text style={styles.label}>Hora de inicio</Text><TimePickerField value={startTime} onChange={setStartTime} disabled={saving} /></View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Fecha</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(0, 4), 10)} onValueChange={(v) => { const nd = `${v}-${plannedDate.slice(5)}`; if (nd >= todayDate && nd >= cycleStart && nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{[parseInt(cycleStart.slice(0, 4), 10), parseInt(cycleEnd.slice(0, 4), 10)].filter((v, i, a) => a.indexOf(v) === i).map((y) => <Picker.Item key={y} label={String(y)} value={y} />)}</Picker></View></View>
                <View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(5, 7), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 5)}${String(v).padStart(2, '0')}-${plannedDate.slice(8)}`; if (nd >= todayDate && nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />)}</Picker></View></View>
                <View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(8, 10), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 8)}${String(v).padStart(2, '0')}`; if (nd >= todayDate && nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <Picker.Item key={d} label={String(d).padStart(2, '0')} value={d} />)}</Picker></View></View>
              </View>
            </View>
            <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}>{saving ? <ActivityIndicator color={Palette.textOnPrimary} size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}</Pressable>
          </>)}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CreateOneOffModal
// ---------------------------------------------------------------------------

function CreateOneOffModal({ userId, cycleId, cycleStart, cycleEnd, todayDate, onClose, onSaved }: { userId: string; cycleId: string; cycleStart: string; cycleEnd: string; todayDate: string; onClose: () => void; onSaved: () => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [trackingType, setTrackingType] = useState<'boolean' | 'minutes'>('boolean');
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState(todayDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data } = await getActiveCategories(userId);
      setCats(data);
      if (data.length > 0) setCategoryId(data[0]!.id);
    })();
  }, [userId]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) { setError('El título es obligatorio.'); return; }
    if (!categoryId) { setError('Selecciona una categoría.'); return; }
    if (duration < 1 || duration > 1440) { setError('Duración inválida.'); return; }
    setSaving(true); setError(null);
    const maxPos = await getMaxPosition(userId, plannedDate);
    const { error: err } = await createTaskOccurrence({
      user_id: userId, cycle_id: cycleId, activity_id: null, schedule_id: null,
      category_id: categoryId, title: trimmed, details: details.trim() || null,
      planned_date: plannedDate, planned_minutes: duration, start_time: startTime,
      tracking_type: trackingType, target_value: trackingType === 'minutes' ? duration : null,
      unit: trackingType === 'minutes' ? 'min' : null, weight: 1,
      source: 'one_off', status: 'pending', completed_value: null, completed_minutes: null, note: null,
      position: maxPos + 1000,
    });
    setSaving(false);
    if (err) { setError('No se pudo crear la tarea.'); return; }
    onSaved();
  }, [title, details, categoryId, trackingType, duration, startTime, userId, cycleId, plannedDate, saving, onSaved]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}><Text style={styles.formTitle}>Tarea puntual</Text><Pressable onPress={onClose}><Text style={styles.formCancel}>Cancelar</Text></Pressable></View>
          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
          <View style={styles.fieldGroup}><Text style={styles.label}>Título</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nombre de la tarea" placeholderTextColor={Palette.textSecondary} editable={!saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Detalle (opcional)</Text><TextInput style={styles.input} value={details} onChangeText={setDetails} editable={!saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Categoría</Text><View style={styles.chipRow}>{cats.map((c) => (<Pressable key={c.id} onPress={() => setCategoryId(c.id)} disabled={saving} style={[styles.chip, categoryId === c.id && { backgroundColor: c.color + '22', borderColor: c.color }]}><CategoryIcon icon={c.icon} color={c.color} size={24} /><Text style={[styles.chipText, categoryId === c.id && { color: c.color }]}>{c.name}</Text></Pressable>))}{cats.length === 0 && <Text style={styles.metaText}>Necesitas una categoría activa para crear esta tarea.</Text>}</View></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Seguimiento</Text><View style={styles.chipRow}><Pressable onPress={() => setTrackingType('boolean')} style={[styles.chip, trackingType === 'boolean' && styles.chipSelected]}><Text style={[styles.chipText, trackingType === 'boolean' && styles.chipTextSelected]}>Confirmación</Text></Pressable><Pressable onPress={() => setTrackingType('minutes')} style={[styles.chip, trackingType === 'minutes' && styles.chipSelected]}><Text style={[styles.chipText, trackingType === 'minutes' && styles.chipTextSelected]}>Minutos</Text></Pressable></View></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Duración</Text><DurationPickerField value={duration} onChange={setDuration} disabled={saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Hora de inicio</Text><TimePickerField value={startTime} onChange={setStartTime} disabled={saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Fecha</Text><View style={styles.dateRow}><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(0, 4), 10)} onValueChange={(v) => { const nd = `${v}-${plannedDate.slice(5)}`; if (nd >= todayDate && nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{[parseInt(cycleStart.slice(0, 4), 10), parseInt(cycleEnd.slice(0, 4), 10)].filter((v2, i, a) => a.indexOf(v2) === i).map((y) => <Picker.Item key={y} label={String(y)} value={y} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(5, 7), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 5)}${String(v).padStart(2, '0')}-${plannedDate.slice(8)}`; if (nd >= todayDate && nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />)}</Picker></View></View><View style={styles.dateCol}><View style={styles.pickerContainer}><Picker selectedValue={parseInt(plannedDate.slice(8, 10), 10)} onValueChange={(v) => { const nd = `${plannedDate.slice(0, 8)}${String(v).padStart(2, '0')}`; if (nd >= todayDate && nd <= cycleEnd) setPlannedDate(nd); }} style={styles.pickerInner}>{Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <Picker.Item key={d} label={String(d).padStart(2, '0')} value={d} />)}</Picker></View></View></View></View>
          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}>{saving ? <ActivityIndicator color={Palette.textOnPrimary} size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}</Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// EditTaskModal (also used for duplicate)
// ---------------------------------------------------------------------------

function EditTaskModal({ userId, task, isDuplicate, todayDate, cycleId, onClose, onSaved }: { userId: string; task: TaskOccurrence; isDuplicate: boolean; todayDate: string; cycleId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [details, setDetails] = useState(task.details ?? '');
  const [duration, setDuration] = useState(task.planned_minutes);
  const [startTime, setStartTime] = useState<string | null>(task.start_time?.slice(0, 5) ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState(todayDate);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) { setError('El título es obligatorio.'); return; }
    if (duration < 1 || duration > 1440) { setError('Duración inválida.'); return; }
    setSaving(true); setError(null);

    if (isDuplicate) {
      const maxPos = await getMaxPosition(userId, plannedDate);
      const { error: err } = await createTaskOccurrence({
        user_id: userId, cycle_id: cycleId, activity_id: task.activity_id, schedule_id: null,
        category_id: task.category_id, title: trimmed, details: details.trim() || null,
        planned_date: plannedDate, planned_minutes: duration, start_time: startTime,
        tracking_type: task.tracking_type, target_value: task.target_value,
        unit: task.unit, weight: task.weight,
        source: task.source === 'one_off' ? 'one_off' : 'manual',
        status: 'pending', completed_value: null, completed_minutes: null, note: null,
        position: maxPos + 1000,
      });
      setSaving(false);
      if (err) { setError('No se pudo duplicar la tarea.'); return; }
    } else {
      const { error: err } = await updateTaskOccurrence(userId, task.id, {
        title: trimmed, details: details.trim() || null,
        planned_minutes: duration, start_time: startTime,
      });
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
          <View style={styles.fieldGroup}><Text style={styles.label}>Detalle (opcional)</Text><TextInput style={styles.input} value={details} onChangeText={setDetails} editable={!saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Duración</Text><DurationPickerField value={duration} onChange={setDuration} disabled={saving} /></View>
          <View style={styles.fieldGroup}><Text style={styles.label}>Hora de inicio</Text><TimePickerField value={startTime} onChange={setStartTime} disabled={saving} /></View>
          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}>{saving ? <ActivityIndicator color={Palette.textOnPrimary} size="small" /> : <Text style={styles.saveBtnText}>{isDuplicate ? 'Duplicar' : 'Guardar'}</Text>}</Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  sortableContainer: { width: '100%', alignSelf: 'stretch' },
  taskTitleWrap: { flex: 1, minWidth: 0 },

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
  taskRow: { flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, alignItems: 'center', width: '100%' },
  dragHandle: { width: 32, height: '100%', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  stripe: { width: 4, alignSelf: 'stretch' },
  taskContent: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 4, minWidth: 0 },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  pillDisabled: { opacity: 0.5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  moreBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: Palette.textSecondary },
  detailsText: { fontSize: 13, color: Palette.textSecondary, lineHeight: 18 },

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

  // Add task button
  addBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  addBtnPressed: { backgroundColor: Palette.primaryDark },
  addBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },

  // Action menu
  actionCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 320, gap: Spacing.sm, alignItems: 'center' },
  actionTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary, marginBottom: Spacing.xs },
  actionBtn: { width: '100%', height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  actionBtnText: { fontSize: 15, fontWeight: '500', color: Palette.textPrimary },
  actionBtnDanger: { borderColor: Palette.errorLight, backgroundColor: Palette.errorLight },
  actionBtnDangerText: { fontSize: 15, fontWeight: '500', color: Palette.error },

  // Form (shared)
  formScroll: { padding: Spacing.lg, gap: Spacing.md, maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined, paddingBottom: Spacing.xxl },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { fontSize: 20, fontWeight: '700', color: Palette.textPrimary },
  formCancel: { fontSize: 15, color: Palette.primary, fontWeight: '500' },
  errorBox: { backgroundColor: Palette.errorLight, borderRadius: Radius.sm, padding: Spacing.sm },
  errorBoxText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '500', color: Palette.textPrimary },
  input: { height: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 16, color: Palette.textPrimary, backgroundColor: Palette.surface },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  chipSelected: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  chipTextSelected: { color: Palette.primary },
  saveBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  saveBtnPressed: { backgroundColor: Palette.primaryDark },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },

  // Routine list
  routineList: { gap: Spacing.sm },
  routineItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Palette.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Palette.border },
  routineItemText: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  routineItemMeta: { fontSize: 13, color: Palette.textSecondary },

  // Move modal
  moveWarning: { fontSize: 13, color: Palette.textSecondary, lineHeight: 18, textAlign: 'center', paddingVertical: Spacing.sm },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateCol: { flex: 1 },
  pickerContainer: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, backgroundColor: Palette.surface, overflow: 'hidden' },
  pickerInner: { height: 48 },
});
