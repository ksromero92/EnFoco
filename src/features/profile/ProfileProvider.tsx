/**
 * ProfileProvider — centralized profile state for EnFoco.
 *
 * Fetches the authenticated user's profile from public.profiles and exposes
 * it via the useProfile hook. Cleans up when the user signs out.
 *
 * Must be rendered inside AuthProvider so it can access the current user.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/src/features/auth/AuthProvider';
import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Profile = Tables<'profiles'>;

interface UpdateProfileInput {
  full_name?: string;
  timezone?: string;
  onboarding_completed?: boolean;
}

interface ProfileContextValue {
  /** The current user's profile (null while loading or if not found) */
  profile: Profile | null;
  /** True while the initial profile fetch is in progress */
  loading: boolean;
  /** Error message if the profile could not be fetched */
  error: string | null;
  /** Re-fetch the profile from the server */
  refreshProfile: () => Promise<void>;
  /** Update the current user's profile fields */
  updateProfile: (input: UpdateProfileInput) => Promise<{ error: string | null }>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the user id we last fetched for to avoid duplicate queries
  const lastFetchedUserId = useRef<string | null>(null);

  // ─── Fetch profile ──────────────────────────────────────────────────────

  const fetchProfile = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      setError('No se pudo cargar tu perfil. Verifica tu conexión e intenta de nuevo.');
      setProfile(null);
    } else if (!data) {
      setError('No se encontró un perfil para tu cuenta. Contacta soporte si el problema persiste.');
      setProfile(null);
    } else {
      setProfile(data);
    }

    setLoading(false);
  }, []);

  // ─── React to user changes ─────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      // User signed out — clean up
      setProfile(null);
      setError(null);
      setLoading(false);
      lastFetchedUserId.current = null;
      return;
    }

    // Avoid duplicate fetch if we already fetched for this user
    if (lastFetchedUserId.current === user.id) {
      return;
    }

    lastFetchedUserId.current = user.id;
    fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ─── Public methods ─────────────────────────────────────────────────────

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    lastFetchedUserId.current = null; // Force re-fetch
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput): Promise<{ error: string | null }> => {
      if (!user) {
        return { error: 'No hay un usuario autenticado.' };
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(input)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        return { error: 'No se pudo guardar tu perfil. Intenta de nuevo.' };
      }

      // Update local state immediately
      setProfile(data);
      return { error: null };
    },
    [user],
  );

  // ─── Context value ──────────────────────────────────────────────────────

  const value: ProfileContextValue = {
    profile,
    loading,
    error,
    refreshProfile,
    updateProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the profile context.
 * Must be used within a component wrapped by ProfileProvider.
 */
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
