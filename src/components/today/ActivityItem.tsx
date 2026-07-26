/**
 * ActivityItem — a single row in the today board.
 * Tapping the status button toggles between pending ↔ complete.
 * Partial status is read-only in this prototype (future: tap to enter value).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import type { Activity, CompletionStatus } from '@/src/types/activity';

interface Props {
  activity: Activity;
  onToggle: (id: string, current: CompletionStatus) => void;
}

const STATUS_CONFIG: Record<
  CompletionStatus,
  { label: string; dotColor: string; bgColor: string; textColor: string }
> = {
  complete:  { label: 'Completa',  dotColor: Palette.complete,  bgColor: Palette.completeLight, textColor: Palette.complete  },
  partial:   { label: 'Parcial',   dotColor: Palette.partial,   bgColor: Palette.partialLight,  textColor: Palette.partial   },
  pending:   { label: 'Pendiente', dotColor: Palette.pending,   bgColor: Palette.pendingLight,  textColor: Palette.textSecondary },
  justified: { label: 'Justif.',   dotColor: Palette.primary,   bgColor: Palette.primaryLight,  textColor: Palette.primary   },
};

export function ActivityItem({ activity, onToggle }: Props) {
  const config = STATUS_CONFIG[activity.status];
  const isToggleable = activity.status === 'pending' || activity.status === 'complete';

  return (
    <View style={styles.container}>
      {/* Category color stripe */}
      <View style={[styles.stripe, { backgroundColor: activity.categoryColor }]} />

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>{activity.name}</Text>

          {/* Status pill — tappable if pending or complete */}
          <Pressable
            onPress={() => isToggleable && onToggle(activity.id, activity.status)}
            style={({ pressed }) => [
              styles.statusPill,
              { backgroundColor: config.bgColor },
              pressed && isToggleable && styles.pillPressed,
            ]}
            accessibilityLabel={`Estado de ${activity.name}: ${config.label}. ${isToggleable ? 'Toca para cambiar.' : ''}`}
            accessibilityRole="button"
          >
            <View style={[styles.statusDot, { backgroundColor: config.dotColor }]} />
            <Text style={[styles.statusText, { color: config.textColor }]}>{config.label}</Text>
          </Pressable>
        </View>

        <View style={styles.bottomLine}>
          <Text style={styles.category}>{activity.category}</Text>
          {activity.startTime && activity.endTime && (
            <Text style={styles.time}>
              {activity.startTime}–{activity.endTime}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stripe: {
    width: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 4,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  pillPressed: {
    opacity: 0.7,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  category: {
    fontSize: 13,
    color: Palette.textSecondary,
  },
  time: {
    fontSize: 13,
    color: Palette.textSecondary,
  },
});
