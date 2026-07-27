/**
 * Auth storage for web.
 *
 * In the browser: delegates to window.localStorage.
 * During Node.js static rendering (expo export -p web): uses an in-memory Map
 * so the export completes without errors.
 *
 * This module must NEVER import expo-sqlite or any native-only dependency.
 */

// ---------------------------------------------------------------------------
// Supabase storage interface (subset of Web Storage API)
// ---------------------------------------------------------------------------

interface SupabaseStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

// ---------------------------------------------------------------------------
// In-memory fallback for Node.js static render
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, string>();

const memoryStorage: SupabaseStorage = {
  getItem(key: string) {
    return memoryStore.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memoryStore.set(key, value);
  },
  removeItem(key: string) {
    memoryStore.delete(key);
  },
};

// ---------------------------------------------------------------------------
// Resolve storage
// ---------------------------------------------------------------------------

function getWebStorage(): SupabaseStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  // Node.js SSR / static export — no window available
  return memoryStorage;
}

export const authStorage = getWebStorage();
