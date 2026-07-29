/**
 * Routines screen — full CRUD for activities with weekly schedules.
 * Supports create, edit, deactivate, reactivate, and safe delete.
 */



// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useAuth } from '@/src/features/auth/AuthProvider';
import type { Activity, Category, Cycle, Schedule } from '@/src/features/routines/routines-service';
import {
  activityHasLogs,
  createActivity,
  createSchedules,
  deactivateActivity,
  deleteActivity,
  getActiveCategories,
  getActiveCycle,
  getAllActivitiesForCycle,
  getSchedulesForActivities,
  getSchedulesForActivity,
  reactivateActivity,
  syncSchedules,
  updateActivity
} from '@/src/features/routines/routines-service';

import { DurationPickerField } from '@/src/components/forms/DurationPickerField';
import { TimePickerField } from '@/src/components/forms/TimePickerField';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const TRACKING_OPTIONS = [
  { value: 'boolean', label: 'Confirmación' },
  { value: 'minutes', label: 'Minutos' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatScheduleDays(scheds: Schedule[]): string {
  return scheds.map((s) => WEEKDAY_LABELS[s.weekday - 1]).join(', ');
}

function formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function RoutinesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Derived lists from single source of truth
  const activities = useMemo(() => allActivities.filter((a) => a.is_active), [allActivities]);
  const inactiveActivities = useMemo(() => allActivities.filter((a) => !a.is_active), [allActivities]);

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Action menu state
  const [actionActivity, setActionActivity] = useState<Activity | null>(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ─── Load data ──────────────────────────────────────────────────────────

  const hasMounted = useRef(false);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = options?.silent ?? false;

    if (!silent) setLoading(true);
    setError(null);

    const { data: cycleData, error: cycleErr } = await getActiveCycle(user.id);
    if (cycleErr) { if (!silent) setError('No se pudo cargar el ciclo activo.'); if (!silent) setLoading(false); return; }
    setCycle(cycleData);

    const { data: cats, error: catErr } = await getActiveCategories(user.id);
    if (catErr) { if (!silent) setError('No se pudieron cargar las categorías.'); if (!silent) setLoading(false); return; }
    setCategories(cats);

    if (!cycleData) {
      setAllActivities([]); setSchedules([]); if (!silent) setLoading(false); return;
    }

    const { data: acts, error: actErr } = await getAllActivitiesForCycle(user.id, cycleData.id);
    if (actErr) { if (!silent) setError('No se pudieron cargar las actividades.'); if (!silent) setLoading(false); return; }
    setAllActivities(acts);

    const allIds = acts.map((a) => a.id);
    const { data: scheds, error: schedErr } = await getSchedulesForActivities(user.id, allIds);
    if (schedErr) { if (!silent) setError('No se pudieron cargar los horarios.'); if (!silent) setLoading(false); return; }
    setSchedules(scheds);
    setLoading(false);
  }, [user]);

  // Refresh every time this tab gains focus
  useFocusEffect(
    useCallback(() => {
      if (hasMounted.current) {
        loadData({ silent: true });
      } else {
        hasMounted.current = true;
        loadData();
      }
    }, [loadData]),
  );

  // ─── Actions ─────────────────────────────────────────────────────────

  const handleEdit = useCallback((act: Activity) => {
    setActionActivity(null);
    setEditingActivity(act);
    setFormVisible(true);
  }, []);

  const handleDeactivate = useCallback(async (act: Activity) => {
    if (!user || actionProcessing) return;
    setActionProcessing(true);
    setActionError(null);
    const { error: err } = await deactivateActivity(act.id, user.id);
    if (err) { setActionError('No se pudo desactivar la actividad.'); setActionProcessing(false); return; }
    await loadData({ silent: true });
    setActionProcessing(false);
    setActionActivity(null);
  }, [user, actionProcessing, loadData]);

  const handleReactivate = useCallback(async (act: Activity) => {
    if (!user || actionProcessing) return;

    setActionProcessing(true);
    setActionError(null);

    const { error: err } = await reactivateActivity(act.id, user.id);

    if (err) {
      setActionError('No se pudo reactivar la actividad.');
      setActionProcessing(false);
      return;
    }

    await loadData({ silent: true });

    // Mostrar inmediatamente la sección de actividades activas
    setShowInactive(false);

    setActionProcessing(false);
    setActionActivity(null);
  }, [user, actionProcessing, loadData]);

  const handleDelete = useCallback(async (act: Activity) => {
    if (!user || actionProcessing) return;

    setActionProcessing(true);
    setActionError(null);

    const hasLogs = await activityHasLogs(user.id, act.id);

    if (hasLogs) {
      setActionError(
        'Esta actividad tiene historial y no puede eliminarse. Puedes mantenerla desactivada.',
      );
      setActionProcessing(false);
      return;
    }

    const { error: err } = await deleteActivity(act.id, user.id);

    if (err) {
      setActionError('No se pudo eliminar la actividad.');
      setActionProcessing(false);
      return;
    }

    const wasLastInactive =
      !act.is_active && inactiveActivities.length <= 1;

    await loadData({ silent: true });

    // Si se eliminó la última inactiva, volver a la vista Activas
    if (wasLastInactive) {
      setShowInactive(false);
    }

    setActionProcessing(false);
    setActionActivity(null);
  }, [
    user,
    actionProcessing,
    inactiveActivities.length,
    loadData,
  ]);

  const handleFormClose = useCallback(() => {
    setFormVisible(false);
    setEditingActivity(null);
  }, []);

  const handleFormSaved = useCallback(async () => {
    handleFormClose();
    await loadData({ silent: true });
  }, [handleFormClose, loadData]);

  // ─── Group activities ────────────────────────────────────────────────

  const grouped = categories
    .map((cat) => ({ category: cat, items: activities.filter((a) => a.category_id === cat.id) }))
    .filter((g) => g.items.length > 0);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadData()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!cycle) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <Header />
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>Sin ciclo activo</Text>
            <Text style={styles.emptyBody}>Necesitas un ciclo para crear actividades.</Text>
            <Pressable onPress={() => loadData()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Header />

        {/* Manage categories link */}
        <Pressable onPress={() => router.push('/categories')} style={styles.manageCatBtn} accessibilityRole="button">
          <Text style={styles.manageCatText}>Gestionar categorías</Text>
          <Text style={styles.manageCatChevron}>›</Text>
        </Pressable>

        {/* Tab: Activas / Inactivas */}
        {inactiveActivities.length > 0 && (
          <View style={styles.tabRow}>
            <Pressable onPress={() => setShowInactive(false)} style={[styles.tab, !showInactive && styles.tabActive]}>
              <Text style={[styles.tabText, !showInactive && styles.tabTextActive]}>Activas ({activities.length})</Text>
            </Pressable>
            <Pressable onPress={() => setShowInactive(true)} style={[styles.tab, showInactive && styles.tabActive]}>
              <Text style={[styles.tabText, showInactive && styles.tabTextActive]}>Inactivas ({inactiveActivities.length})</Text>
            </Pressable>
          </View>
        )}

        {/* Active activities */}
        {!showInactive && (
          <>
            {activities.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>Sin actividades</Text>
                <Text style={styles.emptyBody}>Crea tu primera actividad.</Text>
              </View>
            ) : (
              grouped.map((group) => (
                <View key={group.category.id} style={styles.groupSection}>
                  <View style={styles.groupHeader}>
                    <View style={[styles.catDot, { backgroundColor: group.category.color }]} />
                    <Text style={styles.groupTitle}>{group.category.name}</Text>
                  </View>
                  {group.items.map((act) => {
                    const actScheds = schedules.filter((s) => s.activity_id === act.id);
                    const firstTime = actScheds.find((s) => s.start_time)?.start_time ?? null;
                    return (
                      <Pressable key={act.id} onPress={() => setActionActivity(act)} style={styles.activityRow}>
                        <View style={styles.activityInfo}>
                          <Text style={styles.activityName}>{act.name}</Text>
                          <Text style={styles.activityMeta}>
                            {act.default_duration_minutes ? `${act.default_duration_minutes} min` : ''}
                            {actScheds.length > 0 ? ` · ${formatScheduleDays(actScheds)}` : ''}
                            {firstTime ? ` · ${formatTime(firstTime)}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            )}

            {categories.length > 0 && (
              <Pressable
                onPress={() => { setEditingActivity(null); setFormVisible(true); }}
                style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Nueva actividad"
              >
                <Text style={styles.newBtnText}>+ Nueva actividad</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Inactive activities */}
        {showInactive && (
          <>
            {inactiveActivities.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyBody}>No tienes actividades inactivas.</Text>
              </View>
            ) : (
              inactiveActivities.map((act) => {
                const actScheds = schedules.filter((s) => s.activity_id === act.id);
                const cat = categories.find((c) => c.id === act.category_id);
                return (
                  <Pressable key={act.id} onPress={() => setActionActivity(act)} style={[styles.activityRow, styles.activityRowInactive]}>
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityName, styles.activityNameInactive]}>{act.name}</Text>
                      <Text style={styles.activityMeta}>
                        {cat?.name ?? ''}{act.default_duration_minutes ? ` · ${act.default_duration_minutes} min` : ''}
                        {actScheds.length > 0 ? ` · ${formatScheduleDays(actScheds)}` : ''}
                      </Text>
                    </View>
                    <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactiva</Text></View>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Action menu modal */}
      <ActionMenu
        activity={actionActivity}
        isInactive={actionActivity ? !actionActivity.is_active : false}
        processing={actionProcessing}
        error={actionError}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onDelete={handleDelete}
        onClose={() => { setActionActivity(null); setActionError(null); }}
      />

      {/* Create/Edit form */}
      <ActivityForm
        visible={formVisible}
        cycle={cycle}
        categories={categories}
        userId={user?.id ?? ''}
        editingActivity={editingActivity}
        onClose={handleFormClose}
        onSaved={handleFormSaved}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.logo}>EnFoco</Text>
      <Text style={styles.title}>Rutinas</Text>
      <Text style={styles.subtitle}>Actividades recurrentes</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Action Menu Modal
// ---------------------------------------------------------------------------

interface ActionMenuProps {
  activity: Activity | null;
  isInactive: boolean;
  processing: boolean;
  error: string | null;
  onEdit: (a: Activity) => void;
  onDeactivate: (a: Activity) => void;
  onReactivate: (a: Activity) => void;
  onDelete: (a: Activity) => void;
  onClose: () => void;
}

function ActionMenu({ activity, isInactive, processing, error, onEdit, onDeactivate, onReactivate, onDelete, onClose }: ActionMenuProps) {
  if (!activity) return null;

  return (
    <Modal visible animationType="fade" transparent>
      <Pressable style={styles.overlay} onPress={!processing ? onClose : undefined}>
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>{activity.name}</Text>

          {error && <Text style={styles.actionError}>{error}</Text>}

          {processing && <ActivityIndicator size="small" color={Palette.primary} style={{ marginVertical: 8 }} />}

          {!processing && !isInactive && (
            <>
              <Pressable onPress={() => onEdit(activity)} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => onDeactivate(activity)} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Desactivar</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(activity)} style={[styles.actionBtn, styles.actionBtnDanger]}>
                <Text style={styles.actionBtnTextDanger}>Eliminar</Text>
              </Pressable>
            </>
          )}

          {!processing && isInactive && (
            <>
              <Pressable onPress={() => onReactivate(activity)} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Reactivar</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(activity)} style={[styles.actionBtn, styles.actionBtnDanger]}>
                <Text style={styles.actionBtnTextDanger}>Eliminar</Text>
              </Pressable>
            </>
          )}

          {!processing && (
            <Pressable onPress={onClose} style={[styles.actionBtn, { marginTop: Spacing.sm }]}>
              <Text style={[styles.actionBtnText, { color: Palette.textSecondary }]}>Cancelar</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Activity Form (Create / Edit)
// ---------------------------------------------------------------------------

interface FormProps {
  visible: boolean;
  cycle: Cycle;
  categories: Category[];
  userId: string;
  editingActivity: Activity | null;
  onClose: () => void;
  onSaved: () => void;
}

function ActivityForm({ visible, cycle, categories, userId, editingActivity, onClose, onSaved }: FormProps) {
  const isEditing = editingActivity !== null;

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [duration, setDuration] = useState(30);
  const [trackingType, setTrackingType] = useState<'boolean' | 'minutes'>('boolean');
  const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Load existing data when editing
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSaving(false);

    if (editingActivity) {
      setName(editingActivity.name);
      setCategoryId(editingActivity.category_id);
      setDuration(editingActivity.default_duration_minutes ?? 30);
      setTrackingType(editingActivity.tracking_type === 'minutes' ? 'minutes' : 'boolean');

      // Load existing schedules
      setLoadingSchedules(true);
      getSchedulesForActivity(userId, editingActivity.id).then(({ data: scheds }) => {
        const days = [false, false, false, false, false, false, false];
        let time = '';
        for (const s of scheds ?? []) {
          if (s.weekday >= 1 && s.weekday <= 7) days[s.weekday - 1] = true;
          if (s.start_time && !time) time = s.start_time.slice(0, 5);
        }
        setSelectedDays(days);
        setStartTime(time || null);
        setLoadingSchedules(false);
      });
    } else {
      setName('');
      setCategoryId(categories[0]?.id ?? '');
      setDuration(30);
      setTrackingType('boolean');
      setSelectedDays([true, true, true, true, true, false, false]);
      setStartTime(null);
    }
  }, [visible, editingActivity, userId, categories]);

  const toggleDay = (index: number) => {
    setSelectedDays((prev) => { const n = [...prev]; n[index] = !n[index]; return n; });
  };

  const handleSave = useCallback(async () => {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) { setError('El nombre es obligatorio.'); return; }
    if (!categoryId) { setError('Selecciona una categoría.'); return; }
    const durationNum = duration;
    if (durationNum < 1 || durationNum > 1440) { setError('La duración debe ser entre 1 y 1440 minutos.'); return; }
    if (!selectedDays.some(Boolean)) { setError('Selecciona al menos un día de la semana.'); return; }

    setSaving(true);

    if (isEditing && editingActivity) {
      // Update activity
      const { error: updateErr } = await updateActivity(editingActivity.id, userId, {
        name: trimmedName,
        category_id: categoryId,
        default_duration_minutes: durationNum,
        target_value: editingActivity.tracking_type === 'minutes' ? durationNum : null,
      });
      if (updateErr) { setError('No se pudo actualizar la actividad.'); setSaving(false); return; }

      // Sync schedules
      const { error: syncErr } = await syncSchedules(
        userId, editingActivity.id, selectedDays, startTime, durationNum,
      );
      if (syncErr) { setError('No se pudieron actualizar los horarios.'); setSaving(false); return; }

      setSaving(false);
      onSaved();
    } else {
      // Create activity
      const { data: activity, error: actError } = await createActivity({
        user_id: userId,
        cycle_id: cycle.id,
        category_id: categoryId,
        name: trimmedName,
        tracking_type: trackingType,
        target_value: trackingType === 'minutes' ? durationNum : null,
        unit: trackingType === 'minutes' ? 'min' : null,
        default_duration_minutes: durationNum,
        is_active: true,
      });
      if (actError || !activity) { setError('No se pudo crear la actividad.'); setSaving(false); return; }

      const scheduleInputs = selectedDays
        .map((sel, i) => sel ? { user_id: userId, activity_id: activity.id, weekday: i + 1, start_time: startTime, duration_minutes: durationNum } : null)
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const { error: schedError } = await createSchedules(scheduleInputs);
      if (schedError) {
        await deleteActivity(activity.id, userId);
        setError('No se pudieron guardar los horarios.'); setSaving(false); return;
      }

      setSaving(false);
      onSaved();
    }
  }, [name, categoryId, duration, trackingType, selectedDays, startTime, userId, cycle.id, isEditing, editingActivity, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{isEditing ? 'Editar actividad' : 'Nueva actividad'}</Text>
              <Pressable onPress={onClose} disabled={saving}><Text style={styles.formCancel}>Cancelar</Text></Pressable>
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}
            {loadingSchedules && <ActivityIndicator size="small" color={Palette.primary} />}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre de la actividad" placeholderTextColor={Palette.textSecondary} editable={!saving} accessibilityLabel="Nombre" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.chipRow}>
                {categories.map((cat) => (
                  <Pressable key={cat.id} onPress={() => setCategoryId(cat.id)} style={[styles.chip, categoryId === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color }]} disabled={saving}>
                    <View style={[styles.chipDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.chipText, categoryId === cat.id && { color: cat.color }]}>{cat.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Duración</Text>
              <DurationPickerField value={duration} onChange={setDuration} disabled={saving} />
            </View>

            {/* Tracking type — only for new activities */}
            {!isEditing && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Seguimiento</Text>
                <View style={styles.chipRow}>
                  {TRACKING_OPTIONS.map((opt) => (
                    <Pressable key={opt.value} onPress={() => setTrackingType(opt.value as 'boolean' | 'minutes')} style={[styles.chip, trackingType === opt.value && styles.chipSelected]} disabled={saving}>
                      <Text style={[styles.chipText, trackingType === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Días de la semana</Text>
              <View style={styles.daysRow}>
                {WEEKDAY_LABELS.map((day, i) => (
                  <Pressable key={day} onPress={() => toggleDay(i)} style={[styles.dayBtn, selectedDays[i] && styles.dayBtnSelected]} disabled={saving} accessibilityLabel={`Día ${day}`} accessibilityRole="button">
                    <Text style={[styles.dayText, selectedDays[i] && styles.dayTextSelected]}>{day}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Hora de inicio</Text>
              <TimePickerField value={startTime} onChange={setStartTime} disabled={saving} />
            </View>

            <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]} accessibilityRole="button" accessibilityLabel="Guardar">
              {saving ? <ActivityIndicator color={Palette.textOnPrimary} size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: Palette.background },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl,
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  container: { flex: 1, padding: Spacing.md, gap: Spacing.lg, maxWidth: Platform.OS === 'web' ? 680 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined },
  header: { gap: 4, paddingTop: Spacing.sm },
  logo: { fontSize: 22, fontWeight: '800', color: Palette.primary, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.xs },
  subtitle: { fontSize: 14, color: Palette.textSecondary },

  // Tabs
  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tab: { flex: 1, height: 36, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  tabActive: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  tabTextActive: { color: Palette.primary },

  // Error
  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: { height: 40, paddingHorizontal: Spacing.lg, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },

  // Empty
  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Group
  groupSection: { gap: Spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  groupTitle: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary },

  // Activity row
  activityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  activityRowInactive: { opacity: 0.7 },
  activityInfo: { flex: 1, gap: 2 },
  activityName: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  activityNameInactive: { color: Palette.textSecondary },
  activityMeta: { fontSize: 13, color: Palette.textSecondary },
  chevron: { fontSize: 20, color: Palette.textSecondary, marginLeft: Spacing.sm },
  inactiveBadge: { backgroundColor: Palette.pendingLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: 11, fontWeight: '600', color: Palette.textSecondary },

  // Manage categories
  manageCatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Palette.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  manageCatText: { fontSize: 14, fontWeight: '500', color: Palette.primary },
  manageCatChevron: { fontSize: 18, color: Palette.primary },

  // New button
  newBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  newBtnPressed: { backgroundColor: Palette.primaryDark },
  newBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },

  // Overlay / Action menu
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  actionCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 320, gap: Spacing.sm },
  actionTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  actionError: { fontSize: 13, color: Palette.error, textAlign: 'center', lineHeight: 18 },
  actionBtn: { height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  actionBtnText: { fontSize: 15, fontWeight: '500', color: Palette.textPrimary },
  actionBtnDanger: { borderColor: Palette.errorLight, backgroundColor: Palette.errorLight },
  actionBtnTextDanger: { fontSize: 15, fontWeight: '500', color: Palette.error },

  // Form
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  chipSelected: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, color: Palette.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: Palette.primary },
  daysRow: { flexDirection: 'row', gap: Spacing.sm },
  dayBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  dayBtnSelected: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  dayTextSelected: { color: Palette.textOnPrimary },
  saveBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  saveBtnPressed: { backgroundColor: Palette.primaryDark },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },
});
