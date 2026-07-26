/**
 * Week screen — placeholder.
 * Will show the 7 days of the current week per REQ-WEEK-001.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';

export default function WeekScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>EnFoco</Text>
          <Text style={styles.title}>Semana</Text>
          <Text style={styles.subtitle}>Vista semanal de actividades y cumplimiento</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>📅</Text>
          <Text style={styles.cardTitle}>Próximamente</Text>
          <Text style={styles.cardBody}>
            Aquí verás los 7 días de la semana actual con tus actividades y
            porcentaje de cumplimiento por día.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.lg,
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
  },
  header: {
    gap: 4,
    paddingTop: Spacing.sm,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: Palette.primary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginTop: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: Palette.textSecondary,
  },
  card: {
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
  cardIcon: {
    fontSize: 40,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  cardBody: {
    fontSize: 14,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
