/**
 * CategoryIcon — circular container with a lineal icon from MaterialIcons.
 * Renders the category's color as a soft background with the icon in the
 * category's main color.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// ---------------------------------------------------------------------------
// Icon map — closed list of semantic icons for categories
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, string> = {
  work: 'work-outline',
  study: 'menu-book',
  exercise: 'fitness-center',
  person: 'person-outline',
  home: 'home',
  heart: 'favorite-border',
  family: 'people-outline',
  pets: 'pets',
  code: 'code',
  books: 'auto-stories',
  finance: 'account-balance-wallet',
  travel: 'flight',
  food: 'restaurant',
  music: 'music-note',
  photo: 'photo-camera',
  gaming: 'sports-esports',
  nature: 'eco',
  bike: 'directions-bike',
  rest: 'self-improvement',
};

const FALLBACK_ICON = 'category';

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export function getIconName(key: string | null | undefined): string {
  if (!key) return FALLBACK_ICON;
  return ICON_MAP[key] ?? FALLBACK_ICON;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  icon: string | null | undefined;
  color: string;
  size?: number;
}

export function CategoryIcon({ icon, color, size = 40 }: Props) {
  const iconSize = Math.round(size * 0.52);
  // Derive soft background from color (add 20% opacity)
  const bgColor = color + '1A';

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
      <MaterialIcons name={getIconName(icon) as keyof typeof MaterialIcons.glyphMap} size={iconSize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
