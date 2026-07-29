/**
 * DurationPickerField — hours + minutes picker using @react-native-picker/picker.
 * Converts to/from total minutes for Supabase.
 */

import { Picker } from '@react-native-picker/picker';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

interface Props {
  value: number; // total minutes
  onChange: (minutes: number) => void;
  disabled?: boolean;
}

export function DurationPickerField({ value, onChange, disabled = false }: Props) {
  const hours = Math.min(24, Math.floor(value / 60));
  const minutes = hours === 24 ? 0 : value % 60;

  const handleHoursChange = useCallback((h: number) => {
    const newH = Number(h);
    const newM = newH === 24 ? 0 : minutes;
    onChange(Math.max(1, newH * 60 + newM));
  }, [minutes, onChange]);

  const handleMinutesChange = useCallback((m: number) => {
    const newM = Number(m);
    onChange(Math.max(1, hours * 60 + newM));
  }, [hours, onChange]);

  const hourItems = useMemo(() => Array.from({ length: 25 }, (_, i) => i), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const label = hours > 0 && minutes > 0
    ? `${hours} h ${minutes} min`
    : hours > 0
      ? `${hours} h`
      : `${minutes} min`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.pickerCol}>
          <Text style={styles.pickerLabel}>Horas</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={hours}
              onValueChange={handleHoursChange}
              enabled={!disabled}
              style={styles.picker}
            >
              {hourItems.map((h) => (
                <Picker.Item key={h} label={String(h)} value={h} />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.pickerCol}>
          <Text style={styles.pickerLabel}>Minutos</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={minutes}
              onValueChange={handleMinutesChange}
              enabled={!disabled || hours === 24}
              style={styles.picker}
            >
              {(hours === 24 ? [0] : minuteItems).map((m) => (
                <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />
              ))}
            </Picker>
          </View>
        </View>
      </View>
      <Text style={styles.summary}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.md },
  pickerCol: { flex: 1, gap: 2 },
  pickerLabel: { fontSize: 12, color: Palette.textSecondary, fontWeight: '500' },
  pickerContainer: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, backgroundColor: Palette.surface, overflow: 'hidden' },
  picker: { height: 48 },
  summary: { fontSize: 13, color: Palette.textSecondary, textAlign: 'center' },
});
