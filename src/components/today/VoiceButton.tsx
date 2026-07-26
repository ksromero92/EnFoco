/**
 * VoiceButton — placeholder for the future voice input feature.
 * Per REQ-TODAY-011: shows "Agregar por voz — Próximamente" with no
 * functional voice logic. Displays an informational message when tapped.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

export function VoiceButton() {
  const [showHint, setShowHint] = useState(false);

  function handlePress() {
    setShowHint(true);
    setTimeout(() => setShowHint(false), 2500);
  }

  return (
    <View style={styles.wrapper}>
      {showHint && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            La función de voz estará disponible próximamente.
          </Text>
        </View>
      )}

      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityLabel="Agregar por voz — Próximamente"
        accessibilityRole="button"
        accessibilityHint="Esta función estará disponible en una versión futura"
      >
        {/* Microphone icon using text character — no external lib needed */}
        <Text style={styles.icon}>🎙</Text>
        <Text style={styles.label}>Agregar por voz</Text>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Próximamente</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Palette.border,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Palette.textSecondary,
    flex: 1,
  },
  comingSoonBadge: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.primary,
  },
  hint: {
    backgroundColor: Palette.textPrimary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  hintText: {
    color: Palette.textOnPrimary,
    fontSize: 13,
    textAlign: 'center',
  },
});
