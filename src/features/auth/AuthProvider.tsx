/**
 * AuthProvider — centralized authentication context for EnFoco.
 *
 * Exposes session state and auth methods via the useAuth hook.
 * Must wrap the entire navigation tree in the root layout.
 *
 * Handles:
 * - Initial session retrieval via supabase.auth.getSession()
 * - Real-time auth state changes via onAuthStateChange
 * - Auto-refresh management on iOS/Android via AppState
 * - Clean subscription teardown on unmount
 */

import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** Current Supabase session (null if not authenticated) */
  session: Session | null;
  /** Convenience accessor for session.user */
  user: User | null;
  /** True while resolving the initial session state */
  loading: boolean;
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Create a new account with email + password */
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Sign the current user out */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // ─── Initialize session & subscribe to auth changes ─────────────────────
  useEffect(() => {
    // 1. Get existing session from storage
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setLoading(false);
    });

    // 2. Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    subscriptionRef.current = subscription;

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── Auto-refresh on mobile (AppState foreground/background) ────────────
  useEffect(() => {
    // On web, the browser handles visibility changes and Supabase's built-in
    // autoRefreshToken is sufficient. We only need AppState on native.
    if (Platform.OS === 'web') return;

    const handleAppStateChange = (state: string) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  // ─── Auth methods ───────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: translateAuthError(error.message) };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return { error: translateAuthError(error.message), needsConfirmation: false };
    }

    // If Supabase returns a user but no session, the user needs email confirmation
    const needsConfirmation = data.user !== null && data.session === null;
    return { error: null, needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // ─── Context value ──────────────────────────────────────────────────────

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the authentication context.
 * Must be used within a component wrapped by AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Translates common Supabase auth error messages to user-friendly Spanish.
 * Never exposes sensitive information (keys, URLs, internal codes).
 */
function translateAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu correo no ha sido confirmado. Revisa tu bandeja de entrada.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Ya existe una cuenta con ese correo electrónico.';
  }
  if (lower.includes('password') && lower.includes('least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Demasiados intentos. Espera un momento antes de volver a intentar.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Error de conexión. Verifica tu conexión a internet.';
  }

  // Generic fallback — do not expose the raw error
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
