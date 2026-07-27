/**
 * Auth storage — TypeScript resolution fallback.
 *
 * Metro resolves platform-specific files in this order:
 *   1. auth-storage.native.ts  → iOS / Android
 *   2. auth-storage.web.ts     → Web
 *   3. auth-storage.ts         → Fallback (this file)
 *
 * This fallback uses the same safe web implementation so that any
 * non-platform-specific tooling (type-checkers, static analysis)
 * can resolve the module without errors.
 */

interface SupabaseStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

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

function getStorage(): SupabaseStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export const authStorage = getStorage();
