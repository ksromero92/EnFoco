/**
 * Routines screen — shows activities grouped by category and allows
 * creating new activities with weekly schedules.
 */

import React, { useCallback, useEffect, useState } from 'react';
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
    createActivity,
    createSchedules,
    deleteActivity,
    getActiveCategories,
    getActiveCycle,
    getActivitiesForCycle,
    getSchedulesForActivities,
} from '@/src/features/routines/routines-service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const TRACKING_OPTIONS = [
  { value: 'boolean', label: 'Confirmación' },
  { value: 'minutes', label: 'Minutos' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatScheduleDays(schedules: Schedule[]): string {
  return schedules
    .map((s) => WEEKDAY_LABELS[s.weekday - 1])
    .join(', ');
}

function formatTime(time: string | null): string {
  if (!time) return '';
  // time comes as HH:MM:SS from Supabase — show HH:MM
  return time.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function RoutinesScreen() {
  const { user } = useAuth();

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // ─── Load data ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: cycleData, error: cycleErr } = await getActiveCycle(user.id);
    if (cycleErr) {
      setError('No se pudo cargar el ciclo activo.');
      setLoading(false);
      return;
    }

    setCycle(cycleData);

    const { data: cats, error: catErr } = await getActiveCategories(user.id);
    if (catErr) {
      setError('No se pudieron cargar las categorías.');
      setLoading(false);
      return;
    }
    setCategories(cats);

    if (!cycleData) {
      setActivities([]);
      setSchedules([]);
      setLoading(false);
      return;
    }

    const { data: acts, error: actErr } = await getActivitiesForCycle(user.id, cycleData.id);
    if (actErr) {
      setError('No se pudieron cargar las actividades.');
      setLoading(false);
      return;
    }
    setActivities(acts);

    const ids = acts.map((a) => a.id);
    const { data: scheds, error: schedErr } = await getSchedulesForActivities(user.id, ids);
    if (schedErr) {
      setError('No se pudieron cargar los horarios.');
      setLoading(false);
      return;
    }
    setSchedules(scheds);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Group activities by category ──────────────────────────────────────

  const grouped = categories
    .map((cat) => ({
      category: cat,
      items: activities.filter((a) => a.category_id === cat.id),
    }))
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
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
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
            <Text style={styles.emptyBody}>
              No tienes un ciclo activo. Necesitas un ciclo para crear actividades.
            </Text>
            <Pressable onPress={loadData} style={styles.retryBtn}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        {activities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Sin actividades</Text>
            <Text style={styles.emptyBody}>
              Crea tu primera actividad para comenzar a organizar tu rutina.
            </Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.category.id} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <View style={[styles.catDot, { backgroundColor: group.category.color }]} />
                <Text style={styles.groupTitle}>{group.category.name}</Text>
              </View>
              {group.items.map((act) => {
                const actSchedules = schedules.filter((s) => s.activity_id === act.id);
                const firstTime = actSchedules.find((s) => s.start_time)?.start_time ?? null;
                return (
                  <View key={act.id} style={styles.activityRow}>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityName}>{act.name}</Text>
                      <Text style={styles.activityMeta}>
                        {act.default_duration_minutes ? `${act.default_duration_minutes} min` : ''}
                        {actSchedules.length > 0 ? ` · ${formatScheduleDays(actSchedules)}` : ''}
                        {firstTime ? ` · ${formatTime(firstTime)}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}

        {/* New activity button */}
        {categories.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>
              No hay categorías disponibles. Necesitas categorías para crear actividades.
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Nueva actividad"
          >
            <Text style={styles.newBtnText}>+ Nueva actividad</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* New activity modal */}
      <NewActivityForm
        visible={showForm}
        cycle={cycle}
        categories={categories}
        userId={user?.id ?? ''}
        onClose={() => setShowForm(false)}
        onCreated={loadData}
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
// New Activity Form
// ---------------------------------------------------------------------------

interface FormProps {
  visible: boolean;
  cycle: Cycle;
  categories: Category[];
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewActivityForm({ visible, cycle, categories, userId, onClose, onCreated }: FormProps) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [duration, setDuration] = useState('30');
  const [trackingType, setTrackingType] = useState<'boolean' | 'minutes'>('boolean');
  const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [startTime, setStartTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (visible) {
      setName('');
      setCategoryId(categories[0]?.id ?? '');
      setDuration('30');
      setTrackingType('boolean');
      setSelectedDays([true, true, true, true, true, false, false]);
      setStartTime('');
      setError(null);
    }
  }, [visible, categories]);

  const toggleDay = (index: number) => {
    setSelectedDays((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleSave = useCallback(async () => {
    setError(null);

    // Validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!categoryId) {
      setError('Selecciona una categoría.');
      return;
    }
    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum < 1 || durationNum > 1440) {
      setError('La duración debe ser entre 1 y 1440 minutos.');
      return;
    }
    if (!selectedDays.some(Boolean)) {
      setError('Selecciona al menos un día de la semana.');
      return;
    }
    // Validate start_time format if provided
    const trimmedTime = startTime.trim();
    if (trimmedTime && !/^\d{2}:\d{2}$/.test(trimmedTime)) {
      setError('La hora debe tener formato HH:mm.');
      return;
    }

    setSaving(true);

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

    if (actError || !activity) {
      setError('No se pudo crear la actividad. Intenta de nuevo.');
      setSaving(false);
      return;
    }

    // Create schedules for selected days
    const scheduleInputs = selectedDays
      .map((selected, index) => {
        if (!selected) return null;
        return {
          user_id: userId,
          activity_id: activity.id,
          weekday: index + 1, // 1 = Monday
          start_time: trimmedTime || null,
          duration_minutes: durationNum,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const { error: schedError } = await createSchedules(scheduleInputs);

    if (schedError) {
      // Rollback: delete the activity
      await deleteActivity(activity.id, userId);
      setError('No se pudieron guardar los horarios. Intenta de nuevo.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
    onCreated();
  }, [name, categoryId, duration, trackingType, selectedDays, startTime, userId, cycle.id, onClose, onCreated]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Nueva actividad</Text>
              <Pressable onPress={onClose} disabled={saving}>
                <Text style={styles.formCancel}>Cancelar</Text>
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{error}</Text>
              </View>
            )}

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nombre de la actividad"
                placeholderTextColor={Palette.textSecondary}
                editable={!saving}
                accessibilityLabel="Nombre de la actividad"
              />
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.chipRow}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoryId(cat.id)}
                    style={[
                      styles.chip,
                      categoryId === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color },
                    ]}
                    disabled={saving}
                  >
                    <View style={[styles.chipDot, { backgroundColor: cat.color }]} />
                    <Text
                      style={[styles.chipText, categoryId === cat.id && { color: cat.color }]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Duración (minutos)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="30"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="numeric"
                editable={!saving}
                accessibilityLabel="Duración en minutos"
              />
            </View>

            {/* Tracking type */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Seguimiento</Text>
              <View style={styles.chipRow}>
                {TRACKING_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setTrackingType(opt.value as 'boolean' | 'minutes')}
                    style={[
                      styles.chip,
                      trackingType === opt.value && styles.chipSelected,
                    ]}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        trackingType === opt.value && styles.chipTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Weekdays */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Días de la semana</Text>
              <View style={styles.daysRow}>
                {WEEKDAY_LABELS.map((day, i) => (
                  <Pressable
                    key={day}
                    onPress={() => toggleDay(i)}
                    style={[
                      styles.dayBtn,
                      selectedDays[i] && styles.dayBtnSelected,
                    ]}
                    disabled={saving}
                    accessibilityLabel={`Día ${day}`}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.dayText, selectedDays[i] && styles.dayTextSelected]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Start time */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Hora de inicio (opcional)</Text>
              <TextInput
                style={styles.input}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="07:00"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="numbers-and-punctuation"
                editable={!saving}
                accessibilityLabel="Hora de inicio"
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && !saving && styles.saveBtnPressed,
                saving && styles.saveBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Guardar actividad"
            >
              {saving ? (
                <ActivityIndicator color={Palette.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar</Text>
              )}
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
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  container: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.lg,
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
  },
  header: { gap: 4, paddingTop: Spacing.sm },
  logo: { fontSize: 22, fontWeight: '800', color: Palette.primary, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.xs },
  subtitle: { fontSize: 14, color: Palette.textSecondary },

  // Error
  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },

  // Empty state
  emptyCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Group
  groupSection: { gap: Spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  groupTitle: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary },

  // Activity row
  activityRow: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  activityInfo: { gap: 2 },
  activityName: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  activityMeta: { fontSize: 13, color: Palette.textSecondary },

  // New button
  newBtn: {
    height: 48,
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtnPressed: { backgroundColor: Palette.primaryDark },
  newBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },

  // Form
  formScroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
    paddingBottom: Spacing.xxl,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: Palette.textPrimary },
  formCancel: { fontSize: 15, color: Palette.primary, fontWeight: '500' },

  // Error box
  errorBox: {
    backgroundColor: Palette.errorLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  errorBoxText: { fontSize: 14, color: Palette.error, textAlign: 'center' },

  // Fields
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '500', color: Palette.textPrimary },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Palette.textPrimary,
    backgroundColor: Palette.surface,
  },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  chipSelected: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, color: Palette.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: Palette.primary },

  // Days
  daysRow: { flexDirection: 'row', gap: Spacing.sm },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
  },
  dayBtnSelected: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  dayTextSelected: { color: Palette.textOnPrimary },

  // Save
  saveBtn: {
    height: 48,
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnPressed: { backgroundColor: Palette.primaryDark },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },
});
