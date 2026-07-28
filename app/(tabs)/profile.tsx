/**
 * Profile screen — shows real user data from public.profiles.
 * Displays full_name, email, timezone, and sign-out button.
 */

import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { useProfile } from '@/src/features/profile/ProfileProvider';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  // Use full_name from profile, fallback to email prefix
  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  const performSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const handleSignOut = useCallback(() => {
    if (Platform.OS === 'web') {
      const confirmed = confirm('¿Deseas cerrar sesión?');
      if (confirmed) {
        performSignOut();
      }
      return;
    }

    Alert.alert(
      'Cerrar sesión',
      '¿Deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: performSignOut,
        },
      ],
    );
  }, [performSignOut]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>EnFoco</Text>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>Configuración y datos de cuenta</Text>
        </View>

        {/* Avatar + user info */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userMeta}>{user?.email ?? ''}</Text>
            {profile?.timezone ? (
              <Text style={styles.userTimezone}>{profile.timezone}</Text>
            ) : null}
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

        {/* Sign out button */}
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && !signingOut && styles.signOutPressed,
            signingOut && styles.signOutDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={Palette.error} />
          ) : (
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          )}
        </Pressable>
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
  userInfo: {
    flex: 1,
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
  userTimezone: {
    fontSize: 12,
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
  signOutButton: {
    height: 48,
    backgroundColor: Palette.errorLight,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  signOutPressed: {
    opacity: 0.7,
  },
  signOutDisabled: {
    opacity: 0.5,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.error,
  },
});
