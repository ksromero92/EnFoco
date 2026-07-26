/**
 * Today screen — main daily board.
 * Shows greeting, date, progress card and the activity list.
 * Uses local demo data; will connect to Supabase in a future stage.
 */

import React, { useCallback, useState } from 'react';
import {
    Platform,
    ScrollView,
    StatusBar,
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
import type { Activity, CompletionStatus } from '@/src/types/activity';

// Formats today's date as "Domingo, 26 de julio de 2026"
function formatDate(iso: string): string {
  const date = new Date(iso + 'T12:00:00');
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Greeting based on current hour
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Recalculates percentage from current activity list (simplified for prototype)
function recalcPercentage(activities: Activity[]): number {
  const scoreable = activities.filter((a) => a.countsForScore && a.status !== 'justified');
  if (scoreable.length === 0) return 0;
  const points = scoreable.reduce((sum, a) => {
    if (a.status === 'complete') return sum + 1;
    if (a.status === 'partial') return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((points / scoreable.length) * 100);
}

export default function TodayScreen() {
  const [activities, setActivities] = useState<Activity[]>(DEMO_DAY_SUMMARY.activities);

  const handleToggle = useCallback((id: string, current: CompletionStatus) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const next: CompletionStatus = current === 'pending' ? 'complete' : 'pending';
        return { ...a, status: next };
      })
    );
  }, []);

  const percentage = recalcPercentage(activities);
  const { date, cycleDay, cycleTotalDays, scheduledMinutes, completedMinutes } =
    DEMO_DAY_SUMMARY;

  // Derive classification from live percentage (mirrors REQ-CLASS-001 thresholds)
  const classification =
    percentage >= 80
      ? ('complete' as const)
      : percentage >= 60
        ? ('acceptable' as const)
        : percentage >= 40
          ? ('minimum' as const)
          : ('lost' as const);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Palette.background} />

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
    textTransform: 'capitalize',
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
