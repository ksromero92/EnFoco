/**
 * Onboarding screen — collects full_name and timezone before entering the app.
 *
 * After saving, updates the local profile state and lets Stack.Protected
 * redirect to (tabs) automatically.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/src/features/profile/ProfileProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect the device timezone, fallback to profile value or default */
function detectTimezone(profileTimezone: string | undefined): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) return detected;
  } catch {
    // Intl not available — use profile value
  }
  return profileTimezone ?? 'America/Bogota';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const { profile, updateProfile } = useProfile();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [timezone, setTimezone] = useState(() => detectTimezone(profile?.timezone));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync timezone from device detection on mount
  useEffect(() => {
    setTimezone(detectTimezone(profile?.timezone));
  }, [profile?.timezone]);

  const handleContinue = useCallback(async () => {
    setError(null);

    // Validation
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError('Tu nombre es obligatorio.');
      return;
    }

    const trimmedTz = timezone.trim();
    if (!trimmedTz) {
      setError('La zona horaria no puede estar vacía.');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await updateProfile({
        full_name: trimmedName,
        timezone: trimmedTz,
        onboarding_completed: true,
      });

      if (updateError) {
        setError(updateError);
      }
      // On success, profile state updates → Stack.Protected redirects to (tabs)
    } finally {
      setSaving(false);
    }
  }, [fullName, timezone, updateProfile]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Branding ── */}
          <View style={styles.brandingSection}>
            <Text style={styles.logo}>EnFoco</Text>
            <Text style={styles.title}>Vamos a preparar tu EnFoco</Text>
            <Text style={styles.subtitle}>
              Solo necesitamos un par de datos para personalizar tu experiencia.
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            {/* Error message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Full name field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>¿Cómo quieres que te llamemos?</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Tu nombre"
                placeholderTextColor={Palette.textSecondary}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                editable={!saving}
                accessibilityLabel="Nombre"
              />
            </View>

            {/* Timezone field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Zona horaria</Text>
              <TextInput
                style={styles.input}
                value={timezone}
                onChangeText={setTimezone}
                placeholder="America/Bogota"
                placeholderTextColor={Palette.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                accessibilityLabel="Zona horaria"
              />
              <Text style={styles.hint}>
                Detectada automáticamente. Puedes cambiarla si es incorrecta.
              </Text>
            </View>

            {/* Submit button */}
            <Pressable
              onPress={handleContinue}
              disabled={saving}
              style={({ pressed }) => [
                styles.button,
                pressed && !saving && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continuar"
            >
              {saving ? (
                <ActivityIndicator color={Palette.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.buttonText}>Continuar</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.xl,
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
  },
  brandingSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: Palette.primary,
    letterSpacing: -1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Palette.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Palette.textPrimary,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Palette.textPrimary,
    backgroundColor: Palette.background,
  },
  hint: {
    fontSize: 12,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  button: {
    height: 48,
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  buttonPressed: {
    backgroundColor: Palette.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.textOnPrimary,
  },
  errorBox: {
    backgroundColor: Palette.errorLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: Palette.error,
    textAlign: 'center',
  },
});
