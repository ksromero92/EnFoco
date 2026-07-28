/**
 * ActivityItem — a single row in the today board.
 * Supports boolean toggle (tap pill) and minutes input (tap pill opens modal
 * handled by the parent). Shows a loading indicator when saving.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ItemStatus = 'pending' | 'partial' | 'completed';

export interface TodayActivityProps {
  id: string;
  name: string;
  categoryName: string;
  categoryColor: string;
  startTime: string | null;
  scheduledMinutes: number;
  trackingType: string;
  status: ItemStatus;
  completedMinutes: number;
  saving?: boolean;
  onPress: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ItemStatus,
  { label: string; dotColor: string; bgColor: string; textColor: string }
> = {
  completed: { label: 'Completa', dotColor: Palette.complete, bgColor: Palette.completeLight, textColor: Palette.complete },
  partial:   { label: 'Parcial',  dotColor: Palette.partial,  bgColor: Palette.partialLight,  textColor: Palette.partial  },
  pending:   { label: 'Pendiente', dotColor: Palette.pending, bgColor: Palette.pendingLight,  textColor: Palette.textSecondary },
};

export function ActivityItem({
  id,
  name,
  categoryName,
  categoryColor,
  startTime,
  scheduledMinutes,
  trackingType,
  status,
  completedMinutes,
  saving = false,
  onPress,
}: TodayActivityProps) {
  const config = STATUS_CONFIG[status];

  const timeLabel = startTime ? startTime.slice(0, 5) : null;
  const durationLabel = scheduledMinutes > 0 ? `${scheduledMinutes} min` : null;
  const minutesInfo =
    trackingType === 'minutes' && status === 'partial'
      ? `${completedMinutes}/${scheduledMinutes} min`
      : null;

  return (
    <View style={styles.container}>
      <View style={[styles.stripe, { backgroundColor: categoryColor }]} />

      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>

          <Pressable
            onPress={() => !saving && onPress(id)}
            disabled={saving}
            style={({ pressed }) => [
              styles.statusPill,
              { backgroundColor: config.bgColor },
              pressed && !saving && styles.pillPressed,
            ]}
            accessibilityLabel={`Estado de ${name}: ${config.label}. Toca para cambiar.`}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size={10} color={config.dotColor} />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: config.dotColor }]} />
            )}
            <Text style={[styles.statusText, { color: config.textColor }]}>{config.label}</Text>
          </Pressable>
        </View>

        <View style={styles.bottomLine}>
          <Text style={styles.category}>{categoryName}</Text>
          {timeLabel && <Text style={styles.meta}>{timeLabel}</Text>}
          {durationLabel && <Text style={styles.meta}>{durationLabel}</Text>}
          {minutesInfo && <Text style={styles.meta}>{minutesInfo}</Text>}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
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
    flexWrap: 'wrap',
  },
  category: {
    fontSize: 13,
    color: Palette.textSecondary,
  },
  meta: {
    fontSize: 13,
    color: Palette.textSecondary,
  },
});
