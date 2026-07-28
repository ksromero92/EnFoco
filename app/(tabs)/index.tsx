/**
 * Today screen — daily board connected to Supabase.
 * Shows real activities scheduled for today, allows toggling boolean
 * activities and entering minutes for duration-tracked ones.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { ActivityItem } from '@/src/components/today/ActivityItem';
import { ProgressCard } from '@/src/components/today/ProgressCard';
import { VoiceButton } from '@/src/components/today/VoiceButton';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useProfile } from '@/src/features/profile/ProfileProvider';
import type { CycleRow, TodayItem } from '@/src/features/today/today-service';
import {
    buildTodayItems,
    getActiveCycleForDate,
    getActivitiesForCycle,
    getCategoriesByIds,
    getLogsForDate,
    getSchedulesForWeekday,
    upsertLog,
} from '@/src/features/today/today-service';
import {
    classifyDay,
    formatDateSpanish,
    getCycleDay,
    getCycleTotalDays,
    getGreeting,
    getTodayDate,
    getTodayWeekday,
} from '@/src/features/today/today-utils';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TodayScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const timezone = profile?.timezone ?? 'America/Bogota';

  const [items, setItems] = useState<TodayItem[]>([]);
  const [cycle, setCycle] = useState<CycleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Minutes modal state
  const [minutesModal, setMinutesModal] = useState<TodayItem | null>(null);
  const [minutesInput, setMinutesInput] = useState('');
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [minutesSaving, setMinutesSaving] = useState(false);

  // Derived values
  const todayDate = getTodayDate(timezone);
  const weekday = getTodayWeekday(timezone);

  // ─── Load data ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: cycleData, error: cycleErr } = await getActiveCycleForDate(user.id, todayDate);
    if (cycleErr) {
      setError('No se pudo cargar el ciclo activo.');
      setLoading(false);
      return;
    }
    setCycle(cycleData);

    if (!cycleData) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: activities, error: actErr } = await getActivitiesForCycle(user.id, cycleData.id);
    if (actErr) {
      setError('No se pudieron cargar las actividades.');
      setLoading(false);
      return;
    }

    const activityIds = activities.map((a) => a.id);

    const { data: schedules, error: schedErr } = await getSchedulesForWeekday(user.id, activityIds, weekday);
    if (schedErr) {
      setError('No se pudieron cargar los horarios.');
      setLoading(false);
      return;
    }

    const scheduledActivityIds = schedules.map((s) => s.activity_id);
    const categoryIds = activities
      .filter((a) => scheduledActivityIds.includes(a.id))
      .map((a) => a.category_id);

    const { data: categories, error: catErr } = await getCategoriesByIds(user.id, categoryIds);
    if (catErr) {
      setError('No se pudieron cargar las categorías.');
      setLoading(false);
      return;
    }

    const { data: logs, error: logErr } = await getLogsForDate(user.id, scheduledActivityIds, todayDate);
    if (logErr) {
      setError('No se pudieron cargar los registros del día.');
      setLoading(false);
      return;
    }

    const todayItems = buildTodayItems(activities, schedules, categories, logs);
    setItems(todayItems);
    setLoading(false);
  }, [user, todayDate, weekday]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Progress calculation ───────────────────────────────────────────────

  const scheduledMinutes = items.reduce((s, i) => s + i.scheduledMinutes, 0);
  const completedMinutes = items.reduce((s, i) => s + i.completedMinutes, 0);
  const pendingMinutes = scheduledMinutes - completedMinutes;
  const percentage = scheduledMinutes > 0
    ? Math.min(100, Math.max(0, Math.round((completedMinutes / scheduledMinutes) * 100)))
    : 0;
  const classification = classifyDay(percentage);

  const cycleDay = cycle ? getCycleDay(cycle.start_date, todayDate) : 1;
  const cycleTotalDays = cycle ? getCycleTotalDays(cycle.start_date, cycle.end_date) : 1;

  // ─── Handle activity press ──────────────────────────────────────────────

  const toggleBoolean = useCallback(async (item: TodayItem) => {
    if (!user || savingId) return;
    setSavingId(item.activity.id);

    const isCompleting = item.effectiveStatus !== 'completed';
    const newStatus = isCompleting ? 'completed' : 'pending';
    const newValue = isCompleting ? 1 : 0;
    const newMinutes = isCompleting ? item.scheduledMinutes : 0;

    const { data: log, error: upsertErr } = await upsertLog({
      user_id: user.id,
      activity_id: item.activity.id,
      log_date: todayDate,
      status: newStatus,
      completed_value: newValue,
      completed_minutes: newMinutes,
    });

    if (upsertErr || !log) {
      setSavingId(null);
      // Keep previous state — don't update optimistically
      return;
    }

    // Update local state
    setItems((prev) =>
      prev.map((i) => {
        if (i.activity.id !== item.activity.id) return i;
        return {
          ...i,
          log,
          effectiveStatus: newStatus === 'completed' ? 'completed' : 'pending',
          completedMinutes: newMinutes,
        };
      }),
    );
    setSavingId(null);
  }, [user, savingId, todayDate]);

  const handlePress = useCallback((activityId: string) => {
    const item = items.find((i) => i.activity.id === activityId);
    if (!item || !user) return;

    if (item.activity.tracking_type === 'minutes') {
      // Open minutes modal
      setMinutesModal(item);
      setMinutesInput(item.completedMinutes > 0 ? String(item.completedMinutes) : '');
      setMinutesError(null);
      return;
    }

    // Boolean toggle
    toggleBoolean(item);
  }, [items, user, toggleBoolean]);

  // ─── Minutes modal ──────────────────────────────────────────────────────

  const handleMinutesSave = useCallback(async () => {
    if (!user || !minutesModal || minutesSaving) return;
    setMinutesError(null);

    const value = parseInt(minutesInput, 10);
    if (isNaN(value) || value < 0) {
      setMinutesError('Ingresa un número válido de minutos.');
      return;
    }
    const clamped = Math.min(value, minutesModal.scheduledMinutes);

    let status: string;
    if (clamped === 0) status = 'pending';
    else if (clamped >= minutesModal.scheduledMinutes) status = 'completed';
    else status = 'partial';

    setMinutesSaving(true);

    const { data: log, error: upsertErr } = await upsertLog({
      user_id: user.id,
      activity_id: minutesModal.activity.id,
      log_date: todayDate,
      status,
      completed_value: clamped,
      completed_minutes: clamped,
    });

    if (upsertErr || !log) {
      setMinutesError('No se pudo guardar. Intenta de nuevo.');
      setMinutesSaving(false);
      return;
    }

    // Update local state
    setItems((prev) =>
      prev.map((i) => {
        if (i.activity.id !== minutesModal.activity.id) return i;
        const effectiveStatus: TodayItem['effectiveStatus'] =
          status === 'completed' ? 'completed' : status === 'partial' ? 'partial' : 'pending';
        return {
          ...i,
          log,
          effectiveStatus,
          completedMinutes: Math.min(clamped, i.scheduledMinutes),
        };
      }),
    );

    setMinutesSaving(false);
    setMinutesModal(null);
  }, [user, minutesModal, minutesInput, minutesSaving, todayDate]);

  // ─── Render states ──────────────────────────────────────────────────────

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
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </Pressable>
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
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>EnFoco</Text>
          <Text style={styles.greeting}>
            {getGreeting(timezone)}, {profile?.full_name ?? 'Usuario'}
          </Text>
          <Text style={styles.date}>{formatDateSpanish(todayDate, timezone)}</Text>
        </View>

        {/* ── Progress card ── */}
        {cycle && items.length > 0 && (
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

        {/* ── No cycle ── */}
        {!cycle && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>Sin ciclo activo</Text>
            <Text style={styles.emptyBody}>
              No tienes un ciclo activo que incluya hoy. Crea uno desde Rutinas.
            </Text>
          </View>
        )}

        {/* ── No activities for today ── */}
        {cycle && items.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Sin actividades para hoy</Text>
            <Text style={styles.emptyBody}>
              No tienes actividades programadas para hoy.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/routines')}
              style={styles.linkBtn}
              accessibilityRole="button"
            >
              <Text style={styles.linkBtnText}>Ir a Rutinas</Text>
            </Pressable>
          </View>
        )}

        {/* ── Activity list ── */}
        {items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actividades del día</Text>
            <View style={styles.activityList}>
              {items.map((item) => (
                <ActivityItem
                  key={item.activity.id}
                  id={item.activity.id}
                  name={item.activity.name}
                  categoryName={item.category.name}
                  categoryColor={item.category.color}
                  startTime={item.schedule.start_time}
                  scheduledMinutes={item.scheduledMinutes}
                  trackingType={item.activity.tracking_type}
                  status={item.effectiveStatus}
                  completedMinutes={item.completedMinutes}
                  saving={savingId === item.activity.id}
                  onPress={handlePress}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Voice placeholder ── */}
        <VoiceButton />
      </ScrollView>

      {/* ── Minutes input modal ── */}
      {minutesModal && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{minutesModal.activity.name}</Text>
              <Text style={styles.modalSubtitle}>
                Objetivo: {minutesModal.scheduledMinutes} minutos
              </Text>

              {minutesError && (
                <Text style={styles.modalError}>{minutesError}</Text>
              )}

              <TextInput
                style={styles.modalInput}
                value={minutesInput}
                onChangeText={setMinutesInput}
                placeholder="Minutos realizados"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="numeric"
                editable={!minutesSaving}
                autoFocus
                accessibilityLabel="Minutos realizados"
              />

              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setMinutesModal(null)}
                  disabled={minutesSaving}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleMinutesSave}
                  disabled={minutesSaving}
                  style={({ pressed }) => [
                    styles.modalSaveBtn,
                    pressed && !minutesSaving && styles.modalSaveBtnPressed,
                    minutesSaving && styles.modalSaveBtnDisabled,
                  ]}
                >
                  {minutesSaving ? (
                    <ActivityIndicator size="small" color={Palette.textOnPrimary} />
                  ) : (
                    <Text style={styles.modalSaveText}>Guardar</Text>
                  )}
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
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
    paddingBottom: Spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: { gap: 4, paddingBottom: Spacing.xs },
  logo: { fontSize: 22, fontWeight: '800', color: Palette.primary, letterSpacing: -0.5 },
  greeting: { fontSize: 26, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.xs },
  date: { fontSize: 14, color: Palette.textSecondary },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Palette.textPrimary },
  activityList: { gap: Spacing.sm },

  // Error / retry
  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },

  // Empty states
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
  linkBtn: {
    height: 36,
    paddingHorizontal: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  linkBtnText: { fontSize: 14, fontWeight: '600', color: Palette.primary },

  // Minutes modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 340,
    gap: Spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Palette.textPrimary },
  modalSubtitle: { fontSize: 14, color: Palette.textSecondary },
  modalError: { fontSize: 13, color: Palette.error },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 18,
    color: Palette.textPrimary,
    backgroundColor: Palette.background,
    textAlign: 'center',
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '500', color: Palette.textSecondary },
  modalSaveBtn: {
    flex: 1,
    height: 44,
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnPressed: { backgroundColor: Palette.primaryDark },
  modalSaveBtnDisabled: { opacity: 0.6 },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: Palette.textOnPrimary },
});
