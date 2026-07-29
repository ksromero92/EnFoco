/**
 * TimezonePickerField — modal-based timezone selector.
 * Uses Intl.supportedValuesOf('timeZone') with a fallback list.
 * Shows a search bar and selects IANA timezone identifiers.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Timezone list
// ---------------------------------------------------------------------------

const FALLBACK_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Bogota', 'America/Lima', 'America/Mexico_City', 'America/Cancun',
  'America/Buenos_Aires', 'America/Sao_Paulo', 'America/Santiago', 'America/Caracas',
  'America/Guayaquil', 'America/Panama', 'America/Toronto', 'America/Vancouver',
  'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Cairo', 'Africa/Nairobi',
];

function getTimezoneList(): string[] {
  try {
    // Available in modern runtimes (V8, JSC, Hermes)
    const zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf?.('timeZone');
    if (zones && zones.length > 0) return zones;
  } catch { /* fallback */ }
  return FALLBACK_TIMEZONES;
}

function getLabel(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
  return `${city} — ${tz}`;
}

function getDeviceTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
}

export function TimezonePickerField({ value, onChange, disabled = false }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const allTimezones = useMemo(() => getTimezoneList(), []);
  const deviceTz = useMemo(() => getDeviceTimezone(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      // Show device timezone first if different from current
      if (deviceTz && deviceTz !== value) {
        return [deviceTz, ...allTimezones.filter((tz) => tz !== deviceTz)];
      }
      return allTimezones;
    }
    const q = search.toLowerCase();
    return allTimezones.filter((tz) => tz.toLowerCase().includes(q));
  }, [search, allTimezones, deviceTz, value]);

  const handleSelect = useCallback((tz: string) => {
    onChange(tz);
    setModalVisible(false);
    setSearch('');
  }, [onChange]);

  return (
    <>
      <Pressable
        onPress={() => !disabled && setModalVisible(true)}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel="Seleccionar zona horaria"
      >
        <Text style={styles.fieldValue} numberOfLines={1}>{value || 'Seleccionar...'}</Text>
        <Text style={styles.fieldChevron}>›</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Zona horaria</Text>
            <Pressable onPress={() => { setModalVisible(false); setSearch(''); }}>
              <Text style={styles.modalClose}>Cerrar</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar ciudad o región..."
            placeholderTextColor={Palette.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {deviceTz && !search && deviceTz !== value && (
            <Pressable onPress={() => handleSelect(deviceTz)} style={styles.deviceRow}>
              <Text style={styles.deviceLabel}>Zona detectada</Text>
              <Text style={styles.deviceValue}>{deviceTz}</Text>
            </Pressable>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleSelect(item)} style={[styles.listItem, item === value && styles.listItemSelected]}>
                <Text style={[styles.listItemText, item === value && styles.listItemTextSelected]}>{getLabel(item)}</Text>
              </Pressable>
            )}
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { height: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, backgroundColor: Palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { fontSize: 15, color: Palette.textPrimary, flex: 1 },
  fieldChevron: { fontSize: 20, color: Palette.textSecondary },
  modal: { flex: 1, backgroundColor: Palette.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Palette.textPrimary },
  modalClose: { fontSize: 15, color: Palette.primary, fontWeight: '500' },
  searchInput: { height: 44, marginHorizontal: Spacing.md, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 15, color: Palette.textPrimary, backgroundColor: Palette.surface, marginBottom: Spacing.sm },
  deviceRow: { marginHorizontal: Spacing.md, backgroundColor: Palette.primaryLight, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm },
  deviceLabel: { fontSize: 11, fontWeight: '600', color: Palette.primary },
  deviceValue: { fontSize: 14, color: Palette.primary, fontWeight: '500', marginTop: 2 },
  listItem: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Palette.divider },
  listItemSelected: { backgroundColor: Palette.primaryLight },
  listItemText: { fontSize: 14, color: Palette.textPrimary },
  listItemTextSelected: { color: Palette.primary, fontWeight: '600' },
});
