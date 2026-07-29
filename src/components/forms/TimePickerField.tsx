/**
 * TimePickerField — hour + minute picker with "Sin hora" option.
 * Returns null when no time is selected, otherwise "HH:mm".
 */

import { Picker } from '@react-native-picker/picker';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

interface Props {
  value: string | null; // "HH:mm" or null
  onChange: (time: string | null) => void;
  disabled?: boolean;
}

export function TimePickerField({ value, onChange, disabled = false }: Props) {
  const hasTime = value !== null && value !== '';
  const hour = hasTime ? parseInt(value.slice(0, 2), 10) : 7;
  const minute = hasTime ? parseInt(value.slice(3, 5), 10) : 0;

  const handleToggle = useCallback(() => {
    if (hasTime) {
      onChange(null);
    } else {
      onChange('07:00');
    }
  }, [hasTime, onChange]);

  const handleHourChange = useCallback((h: number) => {
    const hh = String(Number(h)).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  }, [minute, onChange]);

  const handleMinuteChange = useCallback((m: number) => {
    const hh = String(hour).padStart(2, '0');
    const mm = String(Number(m)).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  }, [hour, onChange]);

  const hourItems = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={handleToggle} disabled={disabled} style={styles.toggleRow}>
        <View style={[styles.toggleDot, hasTime && styles.toggleDotActive]} />
        <Text style={styles.toggleText}>{hasTime ? `Hora: ${value}` : 'Sin hora'}</Text>
      </Pressable>

      {hasTime && (
        <View style={styles.row}>
          <View style={styles.pickerCol}>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={hour} onValueChange={handleHourChange} enabled={!disabled} style={styles.picker}>
                {hourItems.map((h) => (
                  <Picker.Item key={h} label={String(h).padStart(2, '0')} value={h} />
                ))}
              </Picker>
            </View>
          </View>
          <Text style={styles.colon}>:</Text>
          <View style={styles.pickerCol}>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={minute} onValueChange={handleMinuteChange} enabled={!disabled} style={styles.picker}>
                {minuteItems.map((m) => (
                  <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  toggleDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Palette.border, backgroundColor: Palette.surface },
  toggleDotActive: { borderColor: Palette.primary, backgroundColor: Palette.primary },
  toggleText: { fontSize: 14, color: Palette.textPrimary, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pickerCol: { flex: 1 },
  pickerContainer: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, backgroundColor: Palette.surface, overflow: 'hidden' },
  picker: { height: 48 },
  colon: { fontSize: 20, fontWeight: '700', color: Palette.textPrimary },
});
