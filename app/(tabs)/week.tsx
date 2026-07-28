/**
 * Week screen — shows the current week (Mon–Sun) with activities and daily summaries.
 * Read-only view; completing activities is done from the Hoy screen.
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
import type { CycleRow, DaySummary } from '@/src/features/week/week-service';
import {
    buildDayItems,
    calcDaySummary,
    getActiveActivities,
    getActiveCycleForRange,
    getAllSchedules,
    getCategoriesByIds,
    getLogsForRange,
} from '@/src/features/week/week-service';
import { formatWeekRange, getCurrentWeekDays } from '@/src/features/week/week-utils';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completa', color: Palette.complete, bg: Palette.completeLight },
  partial:   { label: 'Parcial',  color: Palette.partial,  bg: Palette.partialLight },
  pending:   { label: 'Pendiente', color: Palette.pending, bg: Palette.pendingLight },
};

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
  const [cycle, setCycle] = useState<CycleRow | null>(null);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasMounted = useRef(false);

  // ─── Load data ──────────────────────────────────────────────────────────

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !mondayDate || !sundayDate) return;
    const silent = options?.silent ?? false;

    if (!silent) setLoading(true);
    setError(null);

    const { data: cycleData, error: cycleErr } = await getActiveCycleForRange(user.id, mondayDate, sundayDate);
    if (cycleErr) { if (!silent) setError('No se pudo cargar el ciclo.'); if (!silent) setLoading(false); return; }
    setCycle(cycleData);

    if (!cycleData) {
      setDaySummaries([]);
      setLoading(false);
      return;
    }

    const { data: activities, error: actErr } = await getActiveActivities(user.id, cycleData.id);
    if (actErr) { if (!silent) setError('No se pudieron cargar las actividades.'); if (!silent) setLoading(false); return; }

    const activityIds = activities.map((a) => a.id);

    const { data: schedules, error: schedErr } = await getAllSchedules(user.id, activityIds);
    if (schedErr) { if (!silent) setError('No se pudieron cargar los horarios.'); if (!silent) setLoading(false); return; }

    const categoryIds = activities.map((a) => a.category_id);
    const { data: categories, error: catErr } = await getCategoriesByIds(user.id, categoryIds);
    if (catErr) { if (!silent) setError('No se pudieron cargar las categorías.'); if (!silent) setLoading(false); return; }

    const { data: logs, error: logErr } = await getLogsForRange(user.id, activityIds, mondayDate, sundayDate);
    if (logErr) { if (!silent) setError('No se pudieron cargar los registros.'); if (!silent) setLoading(false); return; }

    // Build summaries for all 7 days
    const summaries = weekDays.map((day) => {
      const items = buildDayItems(day.weekday, day.date, activities, schedules, categories, logs);
      return calcDaySummary(day.date, day.weekday, items);
    });

    setDaySummaries(summaries);
    setLoading(false);
  }, [user, mondayDate, sundayDate, weekDays]);

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

  // ─── Derived ────────────────────────────────────────────────────────────

  const selectedSummary = daySummaries[selectedIndex];

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>EnFoco</Text>
          <Text style={styles.title}>Semana</Text>
          <Text style={styles.subtitle}>{formatWeekRange(mondayDate, sundayDate)}</Text>
        </View>

        {/* No cycle */}
        {!cycle && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>Sin ciclo activo</Text>
            <Text style={styles.emptyBody}>No tienes un ciclo activo que cubra esta semana.</Text>
          </View>
        )}

        {/* Day selector */}
        {cycle && (
          <>
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

            {/* Day summary bar */}
            {selectedSummary && selectedSummary.scheduledMinutes > 0 && (
              <View style={styles.summaryBar}>
                <Text style={styles.summaryPct}>{selectedSummary.percentage}%</Text>
                <Text style={styles.summaryText}>
                  {formatMinutes(selectedSummary.completedMinutes)} / {formatMinutes(selectedSummary.scheduledMinutes)}
                </Text>
              </View>
            )}

            {/* Activities for selected day */}
            {selectedSummary && selectedSummary.items.length > 0 ? (
              <View style={styles.activityList}>
                {selectedSummary.items.map((item) => {
                  const st = STATUS_LABELS[item.effectiveStatus] ?? STATUS_LABELS.pending;
                  const timeLabel = item.schedule.start_time ? item.schedule.start_time.slice(0, 5) : null;
                  return (
                    <View key={item.activity.id} style={styles.activityRow}>
                      <View style={[styles.stripe, { backgroundColor: item.category.color }]} />
                      <View style={styles.activityContent}>
                        <View style={styles.activityTop}>
                          <Text style={styles.activityName} numberOfLines={1}>{item.activity.name}</Text>
                          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>  
                            <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                          </View>
                        </View>
                        <View style={styles.activityBottom}>
                          <Text style={styles.activityMeta}>{item.category.name}</Text>
                          {timeLabel && <Text style={styles.activityMeta}>{timeLabel}</Text>}
                          {item.scheduledMinutes > 0 && <Text style={styles.activityMeta}>{item.scheduledMinutes} min</Text>}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyBody}>No tienes actividades programadas para este día.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDotColor(percentage: number): string {
  if (percentage >= 80) return Palette.complete;
  if (percentage >= 60) return Palette.partial;
  if (percentage >= 40) return Palette.dayMinimum;
  if (percentage > 0) return Palette.dayLost;
  return Palette.pending;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

  // Error
  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: { height: 40, paddingHorizontal: Spacing.lg, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },

  // Empty
  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

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

  // Activity list
  activityList: { gap: Spacing.sm },
  activityRow: { flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  stripe: { width: 4 },
  activityContent: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, gap: 4 },
  activityTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  activityName: { flex: 1, fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  activityBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  activityMeta: { fontSize: 13, color: Palette.textSecondary },
});
