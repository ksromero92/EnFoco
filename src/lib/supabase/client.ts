/**
 * Centralized Supabase client for EnFoco.
 *
 * This is the single place where the Supabase client is created and exported.
 * No component, screen or hook should instantiate Supabase directly.
 *
 * Storage is resolved via platform-specific files:
 *   - auth-storage.native.ts → iOS / Android (expo-sqlite polyfill)
 *   - auth-storage.web.ts   → Web browser (window.localStorage)
 *   - auth-storage.ts       → Fallback / Node.js SSR (in-memory)
 *
 * Metro's platform resolution ensures that the web bundle never includes
 * expo-sqlite, avoiding the wa-sqlite.wasm dependency issue.
 *
 * Variables are read from process.env with the EXPO_PUBLIC_ prefix which Expo
 * injects at build time. Only the publishable (anon) key is used here — the
 * service_role key must NEVER appear in client code.
 */

import { createClient } from '@supabase/supabase-js';


import { authStorage } from './auth-storage';

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

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
