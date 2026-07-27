/**
 * Today screen — main daily board.
 * Shows greeting, date, progress card and the activity list.
 * Uses local demo data; will connect to Supabase in a future stage.
 */

import React, { useCallback, useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Spacing } from '@/constants/theme';
import { ActivityItem } from '@/src/components/today/ActivityItem';
import { ProgressCard } from '@/src/components/today/ProgressCard';
import { VoiceButton } from '@/src/components/today/VoiceButton';
import { DEMO_DAY_SUMMARY, DEMO_USER_NAME } from '@/src/data/demo';
import type { Activity, CompletionStatus, DayClassification } from '@/src/types/activity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats an ISO date string as natural Spanish without auto-capitalisation.
 * e.g. "lunes, 27 de julio de 2026"
 *
 * toLocaleDateString can return "Lunes, …" on some runtimes; we lowercase
 * the first character explicitly instead of using textTransform so the result
 * is always "lunes, …" regardless of locale runtime differences.
 */
function formatDate(iso: string): string {
  const date = new Date(iso + 'T12:00:00');
  const raw = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Lowercase first character — weekday names should not be capitalised in Spanish
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

/** Greeting based on current hour */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ---------------------------------------------------------------------------
// Minute-based recalculation
// ---------------------------------------------------------------------------

/**
 * Returns live stats derived purely from activity minutes.
 *
 * Formula (per requirements):
 *   percentage = round( completedMinutes / scheduledMinutes × 100 )
 *
 * When toggling an activity:
 *   pending  → complete: completedMinutes += durationMinutes
 *   complete → pending:  completedMinutes -= durationMinutes
 *   partial stays read-only in this prototype
 *
 * Division by zero is handled by returning 0 %.
 */
function calcStats(activities: Activity[]): {
  percentage: number;
  completedMinutes: number;
  pendingMinutes: number;
  scheduledMinutes: number;
  classification: DayClassification;
} {
  const scoreable = activities.filter((a) => a.countsForScore && a.status !== 'justified');

  const scheduledMinutes = scoreable.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
  const completedMinutes = scoreable.reduce((s, a) => s + (a.completedMinutes ?? 0), 0);
  const pendingMinutes = scheduledMinutes - completedMinutes;

  const percentage =
    scheduledMinutes > 0 ? Math.round((completedMinutes / scheduledMinutes) * 100) : 0;

  const classification: DayClassification =
    percentage >= 80
      ? 'complete'
      : percentage >= 60
        ? 'acceptable'
        : percentage >= 40
          ? 'minimum'
          : 'lost';

  return { percentage, completedMinutes, pendingMinutes, scheduledMinutes, classification };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TodayScreen() {
  const [activities, setActivities] = useState<Activity[]>(DEMO_DAY_SUMMARY.activities);

  /**
   * Toggles an activity between pending ↔ complete.
   * Updates completedMinutes so all stats recalculate consistently.
   * Partial activities are not toggleable in this prototype.
   */
  const handleToggle = useCallback((id: string, current: CompletionStatus) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (current === 'pending') {
          return { ...a, status: 'complete' as const, completedMinutes: a.durationMinutes ?? 0 };
        }
        if (current === 'complete') {
          return { ...a, status: 'pending' as const, completedMinutes: 0 };
        }
        // partial — not toggleable yet
        return a;
      })
    );
  }, []);

  const { percentage, completedMinutes, pendingMinutes, scheduledMinutes, classification } =
    calcStats(activities);

  const { date, cycleDay, cycleTotalDays } = DEMO_DAY_SUMMARY;

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
            {getGreeting()}, {DEMO_USER_NAME}
          </Text>
          <Text style={styles.date}>{formatDate(date)}</Text>
        </View>

        {/* ── Progress card ── */}
        <ProgressCard
          percentage={percentage}
          classification={classification}
          cycleDay={cycleDay}
          cycleTotalDays={cycleTotalDays}
          scheduledMinutes={scheduledMinutes}
          completedMinutes={completedMinutes}
          pendingMinutes={pendingMinutes}
        />

        {/* ── Activity list ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividades del día</Text>
          <View style={styles.activityList}>
            {activities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                onToggle={handleToggle}
              />
            ))}
          </View>
        </View>

        {/* ── Voice placeholder ── */}
        <VoiceButton />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    // Limit content width on wide screens (web)
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
    paddingBottom: Spacing.xxl,
  },
  header: {
    gap: 4,
    paddingBottom: Spacing.xs,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: Palette.primary,
    letterSpacing: -0.5,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginTop: Spacing.xs,
  },
  date: {
    fontSize: 14,
    color: Palette.textSecondary,
    // No textTransform — lowercasing is handled in formatDate()
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  activityList: {
    gap: Spacing.sm,
  },
});
