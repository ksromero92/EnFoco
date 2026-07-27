/**
 * Root layout — wraps the entire app with AuthProvider and protected routes.
 *
 * Uses Stack.Protected to control access:
 * - (auth) group: only accessible when NOT authenticated
 * - (tabs) group: only accessible when authenticated
 *
 * While loading the initial session, shows a centered loading indicator
 * to avoid briefly flashing tabs or sign-in before the session is resolved.
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/src/features/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Inner layout that uses auth state for route protection
// ---------------------------------------------------------------------------

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();

  const isAuthenticated = session !== null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Palette.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Auth screens — only available when NOT authenticated */}
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        {/* Main app — only available when authenticated */}
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack.Protected>
      </Stack>

      {/*
       * Always use dark status bar content (dark icons/text) so the clock,
       * signal, wifi and battery indicators are visible on the light #F8FAFC
       * background used throughout the app.
       */}
      <StatusBar style="dark" backgroundColor="#F8FAFC" translucent={false} />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Root layout — provides auth context before any navigation
// ---------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
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
});
