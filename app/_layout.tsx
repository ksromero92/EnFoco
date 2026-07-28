/**
 * Root layout — wraps the entire app with AuthProvider, ProfileProvider,
 * and protected routes based on three conditions:
 *
 *   A. No session         → only (auth) is accessible
 *   B. Session + onboarding incomplete → only (onboarding)
 *   C. Session + onboarding complete   → (tabs) and modal
 *
 * While auth or profile is loading, a centered spinner is shown to prevent
 * any flash of incorrect screens.
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/src/features/auth/AuthProvider';
import { ProfileProvider, useProfile } from '@/src/features/profile/ProfileProvider';

// ---------------------------------------------------------------------------
// Inner layout that uses auth + profile state for route protection
// ---------------------------------------------------------------------------

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refreshProfile } = useProfile();

  const isAuthenticated = session !== null;

  // ─── Loading state ──────────────────────────────────────────────────────
  if (authLoading || (isAuthenticated && profileLoading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  // ─── Profile error state (authenticated but no profile found) ───────────
  if (isAuthenticated && profileError && !profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error al cargar perfil</Text>
        <Text style={styles.errorMessage}>{profileError}</Text>
        <Pressable
          onPress={refreshProfile}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Derive guard conditions ────────────────────────────────────────────
  const onboardingComplete = isAuthenticated && profile?.onboarding_completed === true;
  const needsOnboarding = isAuthenticated && !onboardingComplete;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* A. Auth screens — only when NOT authenticated */}
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        {/* B. Onboarding — only when authenticated but onboarding incomplete */}
        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        {/* C. Main app — only when authenticated AND onboarding complete */}
        <Stack.Protected guard={onboardingComplete}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack.Protected>
      </Stack>

      <StatusBar style="dark" backgroundColor="#F8FAFC" translucent={false} />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Root layout — provides auth + profile context before any navigation
// ---------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <RootNavigator />
      </ProfileProvider>
    </AuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Palette.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Palette.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  errorMessage: {
    fontSize: 14,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  retryPressed: {
    opacity: 0.7,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.textOnPrimary,
  },
});
