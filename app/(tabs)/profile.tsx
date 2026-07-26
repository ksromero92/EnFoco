/**
 * Profile screen — placeholder.
 * Will show user settings, timezone, cycle config per REQ-ONB-008.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { DEMO_USER_NAME } from '@/src/data/demo';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>EnFoco</Text>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>Configuración y datos de cuenta</Text>
        </View>

        {/* Avatar placeholder */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {DEMO_USER_NAME.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>{DEMO_USER_NAME}</Text>
            <Text style={styles.userMeta}>Ciclo actual · Día 1 de 90</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardIcon}>👤</Text>
          <Text style={styles.cardTitle}>Próximamente</Text>
          <Text style={styles.cardBody}>
            Aquí podrás editar tu nombre, zona horaria, configurar ciclos y
            gestionar las preferencias de tu cuenta.
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: Palette.textOnPrimary,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  userMeta: {
    fontSize: 13,
    color: Palette.textSecondary,
    marginTop: 2,
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
