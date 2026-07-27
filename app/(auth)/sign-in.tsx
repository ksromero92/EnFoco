/**
 * Sign-in / Sign-up screen for EnFoco.
 *
 * Features:
 * - Toggles between "Iniciar sesión" and "Crear cuenta" modes
 * - Local validation before calling Supabase
 * - Shows confirmation message when sign-up requires email verification
 * - KeyboardAvoidingView for iOS, ScrollView for small screens
 * - Disables buttons while processing
 * - Error messages in Spanish
 */

import React, { useCallback, useState } from 'react';
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
import { useAuth } from '@/src/features/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(
  email: string,
  password: string,
  isSignUp: boolean,
): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return 'El correo electrónico es obligatorio.';
  if (!EMAIL_REGEX.test(trimmedEmail)) return 'Ingresa un correo electrónico válido.';
  if (!password) return 'La contraseña es obligatoria.';
  if (isSignUp && password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setInfo(null);

    // Local validation
    const validationError = validateForm(email, password, isSignUp);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      if (isSignUp) {
        const { error: authError, needsConfirmation } = await signUp(
          email.trim(),
          password,
        );
        if (authError) {
          setError(authError);
        } else if (needsConfirmation) {
          // User created but needs email confirmation
          setInfo(
            'Cuenta creada. Revisa tu correo para confirmar el registro y luego inicia sesión.',
          );
          // Switch to sign-in mode
          setIsSignUp(false);
          setPassword('');
        }
        // If session was returned, onAuthStateChange will handle navigation
      } else {
        const { error: authError } = await signIn(email.trim(), password);
        if (authError) {
          setError(authError);
        }
        // Success → onAuthStateChange triggers navigation via protected routes
      }
    } finally {
      setSubmitting(false);
    }
  }, [email, password, isSignUp, signIn, signUp]);

  const toggleMode = useCallback(() => {
    setIsSignUp((prev) => !prev);
    setError(null);
    setInfo(null);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Branding ── */}
          <View style={styles.brandingSection}>
            <Text style={styles.logo}>EnFoco</Text>
            <Text style={styles.tagline}>Organiza tu día. Enfócate en avanzar.</Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </Text>

            {/* Info message (e.g. after sign-up requiring confirmation) */}
            {info && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{info}</Text>
              </View>
            )}

            {/* Error message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="tu@correo.com"
                placeholderTextColor={Palette.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!submitting}
                accessibilityLabel="Correo electrónico"
              />
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={isSignUp ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
                placeholderTextColor={Palette.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                editable={!submitting}
                accessibilityLabel="Contraseña"
              />
            </View>

            {/* Submit button */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.button,
                pressed && !submitting && styles.buttonPressed,
                submitting && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            >
              {submitting ? (
                <ActivityIndicator color={Palette.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
                </Text>
              )}
            </Pressable>

            {/* Toggle sign-in / sign-up */}
            <Pressable
              onPress={toggleMode}
              disabled={submitting}
              style={styles.toggleRow}
              accessibilityRole="button"
              accessibilityLabel={
                isSignUp
                  ? 'Ya tengo cuenta, iniciar sesión'
                  : 'No tengo cuenta, crear una'
              }
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? '¿Ya tienes cuenta? '
                  : '¿No tienes cuenta? '}
              </Text>
              <Text style={styles.toggleLink}>
                {isSignUp ? 'Iniciar sesión' : 'Crear cuenta'}
              </Text>
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
    maxWidth: Platform.OS === 'web' ? 420 : undefined,
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
  tagline: {
    fontSize: 15,
    color: Palette.textSecondary,
    textAlign: 'center',
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
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Palette.textPrimary,
    textAlign: 'center',
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: Spacing.xs,
  },
  toggleText: {
    fontSize: 14,
    color: Palette.textSecondary,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.primary,
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
  infoBox: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: Palette.primary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
