/**
 * Cycles screen — view history, start new cycle, archive completed ones.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/AuthProvider';
import type { Cycle } from '@/src/features/cycles/cycles-service';
import { archiveCycle, getUserCycles, startNewCycle } from '@/src/features/cycles/cycles-service';
import { useProfile } from '@/src/features/profile/ProfileProvider';
import { getTodayDate } from '@/src/features/today/today-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCycleDay(startDate: string, todayDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const today = new Date(todayDate + 'T00:00:00');
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1);
}

function getCycleTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Activo',     color: Palette.complete,   bg: Palette.completeLight },
  completed: { label: 'Completado', color: Palette.partial,    bg: Palette.partialLight },
  archived:  { label: 'Archivado',  color: Palette.textSecondary, bg: Palette.pendingLight },
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CyclesScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const timezone = profile?.timezone ?? 'America/Bogota';
  const todayDate = getTodayDate(timezone);

  const [allCycles, setAllCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Cycle | null>(null);

  const hasMounted = useRef(false);

  const activeCycle = useMemo(() => allCycles.find((c) => c.status === 'active') ?? null, [allCycles]);
  const historyCycles = useMemo(() => allCycles.filter((c) => c.status !== 'active'), [allCycles]);

  // ─── Load ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);
    const { data, error: err } = await getUserCycles(user.id);
    if (err) { if (!silent) setError('No se pudieron cargar los ciclos.'); }
    else { setAllCycles(data); }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (hasMounted.current) { loadData({ silent: true }); }
      else { hasMounted.current = true; loadData(); }
    }, [loadData]),
  );

  // ─── Archive ────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!confirmArchive || archiving) return;
    setArchiving(confirmArchive.id);
    const { error: err } = await archiveCycle(confirmArchive.id);
    if (err) { setError('No se pudo archivar el ciclo.'); setArchiving(null); setConfirmArchive(null); return; }
    await loadData({ silent: true });
    setArchiving(null);
    setConfirmArchive(null);
  }, [confirmArchive, archiving, loadData]);

  // ─── Form saved ─────────────────────────────────────────────────────────

  const handleNewCycleCreated = useCallback(async () => {
    setFormVisible(false);
    await loadData({ silent: true });
  }, [loadData]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Palette.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Volver">
            <MaterialIcons name="arrow-back" size={24} color={Palette.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Ciclos</Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Active cycle */}
        {activeCycle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ciclo activo</Text>
            <View style={[styles.card, styles.cardActive]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cycleName}>{activeCycle.name}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_CONFIG.active.bg }]}>
                  <Text style={[styles.badgeText, { color: STATUS_CONFIG.active.color }]}>{STATUS_CONFIG.active.label}</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{getCycleDay(activeCycle.start_date, todayDate)}</Text>
                  <Text style={styles.statLabel}>Día</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{getCycleTotalDays(activeCycle.start_date, activeCycle.end_date)}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
              </View>
              <Text style={styles.cardDates}>{formatDate(activeCycle.start_date)} — {formatDate(activeCycle.end_date)}</Text>
            </View>
          </View>
        )}

        {!activeCycle && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin ciclo activo</Text>
            <Text style={styles.emptyBody}>Inicia un nuevo ciclo para organizar tus actividades.</Text>
          </View>
        )}

        {/* New cycle button */}
        <Pressable onPress={() => setFormVisible(true)} style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]} accessibilityRole="button">
          <Text style={styles.newBtnText}>+ Iniciar nuevo ciclo</Text>
        </Pressable>

        {/* History */}
        {historyCycles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {historyCycles.map((c) => {
              const st = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.archived;
              return (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cycleName}>{c.name}</Text>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDates}>
                    {formatDate(c.start_date)} — {formatDate(c.end_date)} · {getCycleTotalDays(c.start_date, c.end_date)} días
                  </Text>
                  {c.status === 'completed' && (
                    <Pressable onPress={() => setConfirmArchive(c)} disabled={archiving === c.id} style={styles.archiveBtn}>
                      {archiving === c.id ? <ActivityIndicator size="small" color={Palette.textSecondary} /> : <Text style={styles.archiveBtnText}>Archivar</Text>}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Archive confirmation */}
      {confirmArchive && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.overlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Archivar ciclo</Text>
              <Text style={styles.confirmBody}>¿Deseas archivar &ldquo;{confirmArchive.name}&rdquo;? Esta acción no puede deshacerse.</Text>
              <View style={styles.confirmActions}>
                <Pressable onPress={() => setConfirmArchive(null)} style={styles.confirmCancel}><Text style={styles.confirmCancelText}>Cancelar</Text></Pressable>
                <Pressable onPress={handleArchive} style={styles.confirmOk}><Text style={styles.confirmOkText}>Archivar</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* New cycle form */}
      <NewCycleForm visible={formVisible} todayDate={todayDate} onClose={() => setFormVisible(false)} onCreated={handleNewCycleCreated} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// New Cycle Form
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [
  { label: '30 días', value: 30 },
  { label: '60 días', value: 60 },
  { label: '90 días', value: 90 },
  { label: 'Personalizada', value: 0 },
];

interface FormProps { visible: boolean; todayDate: string; onClose: () => void; onCreated: () => void; }

function NewCycleForm({ visible, todayDate, onClose, onCreated }: FormProps) {
  const [name, setName] = useState('');
  const [durationOption, setDurationOption] = useState(90);
  const [customDuration, setCustomDuration] = useState('90');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName('');
      setDurationOption(90); setCustomDuration('90'); setError(null); setSaving(false); setShowConfirm(false);
    }
  }, [visible]);

  const effectiveDuration = durationOption > 0 ? durationOption : parseInt(customDuration, 10);

  const handleSubmit = useCallback(() => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError('El nombre es obligatorio.'); return; }
    if (isNaN(effectiveDuration) || effectiveDuration < 7 || effectiveDuration > 365) { setError('La duración debe ser entre 7 y 365 días.'); return; }
    // Show confirmation
    setShowConfirm(true);
  }, [name, effectiveDuration]);

  const handleConfirm = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setShowConfirm(false);
    const { error: err } = await startNewCycle(name.trim(), todayDate, effectiveDuration);
    setSaving(false);
    if (err) {
      const msg = err.message?.includes('P0002') ? 'El nombre es obligatorio.'
        : err.message?.includes('P0003') ? 'La duración debe ser entre 7 y 365 días.'
        : err.message?.includes('P0007') ? 'El nuevo ciclo debe comenzar hoy.'
        : 'No se pudo crear el ciclo. Intenta de nuevo.';
      setError(msg); return;
    }
    onCreated();
  }, [saving, name, todayDate, effectiveDuration, onCreated]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Nuevo ciclo</Text>
            <Pressable onPress={onClose} disabled={saving}><Text style={styles.formCancel}>Cancelar</Text></Pressable>
          </View>

          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}

          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Mi nuevo ciclo" placeholderTextColor={Palette.textSecondary} editable={!saving} accessibilityLabel="Nombre del ciclo" />
          </View>

          {/* Date — fixed to today */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Fecha de inicio</Text>
            <View style={styles.todayDateBox}>
              <Text style={styles.todayDateText}>Hoy, {formatDate(todayDate)}</Text>
            </View>
          </View>

          {/* Duration */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Duración</Text>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map((opt) => (
                <Pressable key={opt.value} onPress={() => setDurationOption(opt.value)} style={[styles.chip, durationOption === opt.value && styles.chipSelected]} disabled={saving}>
                  <Text style={[styles.chipText, durationOption === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            {durationOption === 0 && (
              <TextInput style={styles.input} value={customDuration} onChangeText={setCustomDuration} placeholder="90" keyboardType="numeric" editable={!saving} accessibilityLabel="Duración personalizada" />
            )}
          </View>

          {/* Submit */}
          <Pressable onPress={handleSubmit} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]} accessibilityRole="button">
            {saving ? <ActivityIndicator color={Palette.textOnPrimary} size="small" /> : <Text style={styles.saveBtnText}>Iniciar nuevo ciclo</Text>}
          </Pressable>
        </ScrollView>

        {/* Confirmation modal */}
        {showConfirm && (
          <Modal visible animationType="fade" transparent>
            <View style={styles.overlay}>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>Iniciar nuevo ciclo</Text>
                <Text style={styles.confirmBody}>
                  Al iniciar un nuevo ciclo, el ciclo actual se marcará como completado. El nuevo ciclo comenzará sin rutinas. Tu historial anterior no se eliminará.
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable onPress={() => setShowConfirm(false)} style={styles.confirmCancel}><Text style={styles.confirmCancelText}>Cancelar</Text></Pressable>
                  <Pressable onPress={handleConfirm} style={styles.confirmOk}><Text style={styles.confirmOkText}>Iniciar nuevo ciclo</Text></Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl, maxWidth: Platform.OS === 'web' ? 680 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: Palette.textPrimary },
  errorText: { fontSize: 13, color: Palette.error },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Palette.textPrimary },

  card: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardActive: { borderWidth: 1.5, borderColor: Palette.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cycleName: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary, flex: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing.sm },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700', color: Palette.primary },
  statLabel: { fontSize: 12, color: Palette.textSecondary },
  statDivider: { width: 1, height: 32, backgroundColor: Palette.border },
  cardDates: { fontSize: 13, color: Palette.textSecondary },
  archiveBtn: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 4, backgroundColor: Palette.pendingLight, borderRadius: Radius.sm, marginTop: Spacing.xs },
  archiveBtnText: { fontSize: 12, fontWeight: '600', color: Palette.textSecondary },

  emptyCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  emptyBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center' },

  newBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  newBtnPressed: { backgroundColor: Palette.primaryDark },
  newBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },

  // Confirm modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  confirmCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 340, gap: Spacing.md },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  confirmBody: { fontSize: 14, color: Palette.textSecondary, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  confirmCancel: { flex: 1, height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: 15, fontWeight: '500', color: Palette.textSecondary },
  confirmOk: { flex: 1, height: 44, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  confirmOkText: { fontSize: 15, fontWeight: '600', color: Palette.textOnPrimary },

  // Form
  formScroll: { padding: Spacing.lg, gap: Spacing.md, maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined, paddingBottom: Spacing.xxl },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { fontSize: 20, fontWeight: '700', color: Palette.textPrimary },
  formCancel: { fontSize: 15, color: Palette.primary, fontWeight: '500' },
  errorBox: { backgroundColor: Palette.errorLight, borderRadius: Radius.sm, padding: Spacing.sm },
  errorBoxText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '500', color: Palette.textPrimary },
  input: { height: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 16, color: Palette.textPrimary, backgroundColor: Palette.surface },
  todayDateBox: { height: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, backgroundColor: Palette.divider, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  todayDateText: { fontSize: 15, fontWeight: '500', color: Palette.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  chipSelected: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  chipTextSelected: { color: Palette.primary },
  saveBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  saveBtnPressed: { backgroundColor: Palette.primaryDark },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },
});
