/**
 * ProgressCard — shows the daily completion percentage, classification,
 * cycle info, and scheduled vs completed time.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import type { DayClassification } from '@/src/types/activity';

interface Props {
  percentage: number;
  classification: DayClassification;
  cycleDay: number;
  cycleTotalDays: number;
  scheduledMinutes: number;
  completedMinutes: number;
}

// Classification labels and colors (mirrors REQ-CLASS-001 thresholds)
const CLASSIFICATION_CONFIG: Record<
  DayClassification,
  { label: string; color: string; bgColor: string }
> = {
  complete:   { label: 'Día completo',  color: Palette.dayComplete,   bgColor: Palette.completeLight },
  acceptable: { label: 'Día aceptable', color: Palette.dayAcceptable, bgColor: Palette.partialLight  },
  minimum:    { label: 'Día mínimo',    color: Palette.dayMinimum,    bgColor: '#FFEDD5'             },
  lost:       { label: 'Día perdido',   color: Palette.dayLost,       bgColor: Palette.errorLight    },
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ProgressCard({
  percentage,
  classification,
  cycleDay,
  cycleTotalDays,
  scheduledMinutes,
  completedMinutes,
}: Props) {
  const config = CLASSIFICATION_CONFIG[classification];
  const clampedPct = Math.min(100, Math.max(0, percentage));

  return (
    <View style={styles.card}>
      {/* Top row: percentage + classification */}
      <View style={styles.topRow}>
        <View style={styles.percentageBlock}>
          <Text style={styles.percentageText}>{clampedPct}%</Text>
          <Text style={styles.percentageLabel}>cumplimiento</Text>
        </View>

        <View style={styles.rightBlock}>
          <View style={[styles.badge, { backgroundColor: config.bgColor }]}>
            <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.cycleText}>
            Día {cycleDay} de {cycleTotalDays}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${clampedPct}%`, backgroundColor: config.color }]} />
      </View>

      {/* Bottom row: time stats */}
      <View style={styles.timeRow}>
        <View style={styles.timeStat}>
          <Text style={styles.timeValue}>{formatMinutes(completedMinutes)}</Text>
          <Text style={styles.timeLabel}>completadas</Text>
        </View>
        <View style={styles.timeDivider} />
        <View style={styles.timeStat}>
          <Text style={styles.timeValue}>{formatMinutes(scheduledMinutes - completedMinutes)}</Text>
          <Text style={styles.timeLabel}>pendientes</Text>
        </View>
        <View style={styles.timeDivider} />
        <View style={styles.timeStat}>
          <Text style={styles.timeValue}>{formatMinutes(scheduledMinutes)}</Text>
          <Text style={styles.timeLabel}>programadas</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  percentageBlock: {
    alignItems: 'flex-start',
  },
  percentageText: {
    fontSize: 40,
    fontWeight: '700',
    color: Palette.textPrimary,
    lineHeight: 44,
  },
  percentageLabel: {
    fontSize: 13,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  rightBlock: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cycleText: {
    fontSize: 13,
    color: Palette.textSecondary,
  },
  barTrack: {
    height: 8,
    backgroundColor: Palette.divider,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  timeStat: {
    alignItems: 'center',
    flex: 1,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  timeLabel: {
    fontSize: 12,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  timeDivider: {
    width: 1,
    height: 28,
    backgroundColor: Palette.border,
  },
});
