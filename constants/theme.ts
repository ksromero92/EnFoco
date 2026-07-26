/**
 * EnFoco design tokens.
 * All colors used across the app are defined here.
 * Components must not contain literal color values.
 */

// ─── EnFoco brand palette ────────────────────────────────────────────────────
export const Palette = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1D4ED8',

  background: '#F8FAFC',
  surface: '#FFFFFF',

  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textOnPrimary: '#FFFFFF',

  border: '#E2E8F0',
  divider: '#F1F5F9',

  // Completion states
  complete: '#10B981',
  completeLight: '#D1FAE5',
  partial: '#F59E0B',
  partialLight: '#FEF3C7',
  pending: '#94A3B8',
  pendingLight: '#F1F5F9',

  // Day classification
  dayComplete: '#10B981',
  dayAcceptable: '#F59E0B',
  dayMinimum: '#F97316',
  dayLost: '#EF4444',

  error: '#EF4444',
  errorLight: '#FEE2E2',
} as const;

// ─── Navigation colors (required by Expo Router / React Navigation) ──────────
export const Colors = {
  light: {
    text: Palette.textPrimary,
    background: Palette.background,
    tint: Palette.primary,
    icon: Palette.textSecondary,
    tabIconDefault: Palette.textSecondary,
    tabIconSelected: Palette.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#FFFFFF',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#FFFFFF',
  },
};

// ─── Spacing scale ───────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Border radius scale ─────────────────────────────────────────────────────
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
