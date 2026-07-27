/**
 * Centralized Supabase client for EnFoco.
 *
 * This is the single place where the Supabase client is created and exported.
 * No component, screen or hook should instantiate Supabase directly.
 *
 * Uses expo-sqlite's localStorage polyfill so that auth session persistence
 * works consistently across iOS, Android and web.
 *
 * Variables are read from process.env with the EXPO_PUBLIC_ prefix which Expo
 * injects at build time. Only the publishable (anon) key is used here — the
 * service_role key must NEVER appear in client code.
 */

// Install the localStorage polyfill from expo-sqlite before any Supabase
// code runs. On web this is a no-op since localStorage already exists.
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    '[EnFoco] Missing environment variable: EXPO_PUBLIC_SUPABASE_URL. ' +
      'Add it to .env.local and restart the dev server.',
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '[EnFoco] Missing environment variable: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Add it to .env.local and restart the dev server.',
  );
}

// ---------------------------------------------------------------------------
// Client instance
// ---------------------------------------------------------------------------

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
