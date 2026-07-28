/**
 * Progress screen — weekly stats, daily classification, category performance.
 * Read-only view using real data from Supabase.
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
import type { CycleRow } from '@/src/features/progress/progress-service';
import {
    buildProgressData,
    getActiveActivities,
    getActiveCycleForRange,
    getAllSchedules,
    getCategories,
    getLogsForRange,
} from '@/src/features/progress/progress-service';
import type { CategoryProgress, ProgressDay, WeekSummary } from '@/src/features/progress/progress-utils';
import { computeWeekSummary } from '@/src/features/progress/progress-utils';
import { getTodayDate } from '@/src/features/today/today-utils';
import { formatWeekRange, getCurrentWeekDays } from '@/src/features/week/week-utils';

// ---------------------------------------------------------------------------
// Classification config
// ---------------------------------------------------------------------------

const CLASS_CONFIG = {
  complete:   { label: 'Completo',  color: Palette.dayComplete,   bg: Palette.completeLight },
  acceptable: { label: 'Aceptable', color: Palette.dayAcceptable, bg: Palette.partialLight  },
  minimum:    { label: 'Mínimo',    color: Palette.dayMinimum,    bg: '#FFEDD5'             },
  lost:       { label: 'Perdido',   color: Palette.dayLost,       bg: Palette.errorLight    },
} as const;

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

  const [cycle, setCycle] = useState<CycleRow | null>(null);
  const [days, setDays] = useState<ProgressDay[]>([]);
  const [catProgress, setCatProgress] = useState<CategoryProgress[]>([]);
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasMounted = useRef(false);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !mondayDate || !sundayDate) return;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);

    const { data: cycleData, error: cycleErr } = await getActiveCycleForRange(user.id, mondayDate, sundayDate);
    if (cycleErr) { if (!silent) setError('No se pudo cargar el ciclo.'); if (!silent) setLoading(false); return; }
    setCycle(cycleData);

    if (!cycleData) { setDays([]); setCatProgress([]); setSummary(null); setLoading(false); return; }

    const { data: activities, error: actErr } = await getActiveActivities(user.id, cycleData.id);
    if (actErr) { if (!silent) setError('No se pudieron cargar las actividades.'); if (!silent) setLoading(false); return; }

    const activityIds = activities.map((a) => a.id);

    const { data: schedules, error: schedErr } = await getAllSchedules(user.id, activityIds);
    if (schedErr) { if (!silent) setError('No se pudieron cargar los horarios.'); if (!silent) setLoading(false); return; }

    const categoryIds = activities.map((a) => a.category_id);
    const { data: categories, error: catErr } = await getCategories(user.id, categoryIds);
    if (catErr) { if (!silent) setError('No se pudieron cargar las categorías.'); if (!silent) setLoading(false); return; }

    // Only fetch logs up to today (not future days)
    const { data: logs, error: logErr } = await getLogsForRange(user.id, activityIds, mondayDate, todayDate);
    if (logErr) { if (!silent) setError('No se pudieron cargar los registros.'); if (!silent) setLoading(false); return; }

    const { days: progressDays, categoryProgress } = buildProgressData(weekDays, todayDate, activities, schedules, categories, logs);
    setDays(progressDays);
    setCatProgress(categoryProgress);
    setSummary(computeWeekSummary(progressDays));
    setLoading(false);
  }, [user, mondayDate, sundayDate, todayDate, weekDays]);

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

        {!cycle && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>Sin ciclo activo</Text>
            <Text style={styles.emptyBody}>No tienes un ciclo activo que cubra esta semana.</Text>
          </View>
        )}

        {cycle && summary && (
          <>
            {/* Main summary card */}
            <View style={styles.mainCard}>
              <Text style={styles.mainPct}>{summary.percentage}%</Text>
              <Text style={styles.mainLabel}>cumplimiento semanal</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${summary.percentage}%` }]} />
              </View>
              <Text style={styles.mainTime}>
                {formatMinutes(summary.totalCompletedMinutes)} / {formatMinutes(summary.totalScheduledMinutes)}
              </Text>
            </View>

            {/* Classification counters */}
            <View style={styles.countersRow}>
              <CounterBadge label="Completos" count={summary.daysComplete} color={Palette.dayComplete} bg={Palette.completeLight} />
              <CounterBadge label="Aceptables" count={summary.daysAcceptable} color={Palette.dayAcceptable} bg={Palette.partialLight} />
              <CounterBadge label="Mínimos" count={summary.daysMinimum} color={Palette.dayMinimum} bg="#FFEDD5" />
              <CounterBadge label="Perdidos" count={summary.daysLost} color={Palette.dayLost} bg={Palette.errorLight} />
            </View>

            {/* Day-by-day breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resumen diario</Text>
              <View style={styles.dayList}>
                {days.map((d) => (
                  <DayRow key={d.date} day={d} />
                ))}
              </View>
            </View>

            {/* Category performance */}
            {catProgress.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rendimiento por categoría</Text>
                <View style={styles.catList}>
                  {catProgress.map((c) => (
                    <CategoryRow key={c.id} category={c} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {cycle && summary && summary.totalScheduledMinutes === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>No hay actividades programadas para esta semana.</Text>
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

  if (!day.hasActivities) {
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
// Helpers
// ---------------------------------------------------------------------------

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

  errorText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  retryBtn: { height: 40, paddingHorizontal: Spacing.lg, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Palette.textOnPrimary },

  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Main summary card
  mainCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  mainPct: { fontSize: 48, fontWeight: '700', color: Palette.textPrimary, lineHeight: 52 },
  mainLabel: { fontSize: 14, color: Palette.textSecondary },
  barTrack: { width: '100%', height: 8, backgroundColor: Palette.divider, borderRadius: Radius.full, overflow: 'hidden', marginTop: Spacing.xs },
  barFill: { height: '100%', backgroundColor: Palette.primary, borderRadius: Radius.full },
  mainTime: { fontSize: 13, color: Palette.textSecondary, marginTop: Spacing.xs },

  // Counter badges
  countersRow: { flexDirection: 'row', gap: Spacing.sm },
  counterBadge: { flex: 1, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', gap: 2 },
  counterCount: { fontSize: 20, fontWeight: '700' },
  counterLabel: { fontSize: 10, fontWeight: '600', color: Palette.textSecondary, textAlign: 'center' },

  // Sections
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Palette.textPrimary },

  // Day rows
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

  // Category rows
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
