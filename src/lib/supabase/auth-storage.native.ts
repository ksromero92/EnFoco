/**
 * Auth storage for iOS and Android.
 *
 * Installs the expo-sqlite localStorage polyfill as a side effect.
 * This module is resolved by Metro only on native platforms (.native.ts).
 * The web bundle will never include this file.
 */

import 'expo-sqlite/localStorage/install';

/**
 * After the polyfill is installed, globalThis.localStorage is available
 * and backed by a SQLite database for persistent session storage.
 */
export const authStorage = globalThis.localStorage;
