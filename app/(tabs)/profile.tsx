/**
 * Profile screen — user info, active cycle, edit profile, and sign out.
 * Connected to Supabase via ProfileProvider and routines-service.
 */

import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
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
import { useProfile } from '@/src/features/profile/ProfileProvider';
import type { Cycle } from '@/src/features/routines/routines-service';
import { getActiveCycle } from '@/src/features/routines/routines-service';
import { getTodayDate } from '@/src/features/today/today-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCycleDay(startDate: string, todayDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const today = new Date(todayDate + 'T00:00:00');
  const diffMs = today.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

function getCycleTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const timezone = profile?.timezone ?? 'America/Bogota';

  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [cycleLoading, setCycleLoading] = useState(true);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  const hasMounted = useRef(false);

  // ─── Load cycle ─────────────────────────────────────────────────────────

  const loadCycle = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = options?.silent ?? false;
    if (!silent) setCycleLoading(true);
    setCycleError(null);

    const { data, error } = await getActiveCycle(user.id);
    if (error) { if (!silent) setCycleError('No se pudo cargar el ciclo.'); }
    else { setCycle(data); }
    setCycleLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (hasMounted.current) {
        loadCycle({ silent: true });
      } else {
        hasMounted.current = true;
        loadCycle();
      }
    }, [loadCycle]),
  );

  // ─── Derived ────────────────────────────────────────────────────────────

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();
  const todayDate = getTodayDate(timezone);
  const cycleDay = cycle ? getCycleDay(cycle.start_date, todayDate) : null;
  const cycleTotalDays = cycle ? getCycleTotalDays(cycle.start_date, cycle.end_date) : null;

  // ─── Sign out ───────────────────────────────────────────────────────────

  const performSignOut = useCallback(async () => {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
  }, [signOut]);

  const handleSignOut = useCallback(() => {
    if (Platform.OS === 'web') {
      const confirmed = confirm('¿Deseas cerrar sesión?');
      if (confirmed) performSignOut();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: performSignOut },
    ]);
  }, [performSignOut]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>EnFoco</Text>
          <Text style={styles.title}>Perfil</Text>
        </View>

        {/* ── Mi perfil ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mi perfil</Text>
          <View style={styles.card}>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.userMeta}>{user?.email ?? ''}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Zona horaria</Text>
              <Text style={styles.infoValue}>{profile?.timezone ?? '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Miembro desde</Text>
              <Text style={styles.infoValue}>{profile?.created_at ? formatDate(profile.created_at.slice(0, 10)) : '—'}</Text>
            </View>
            <Pressable
              onPress={() => setEditVisible(true)}
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Editar perfil"
            >
              <Text style={styles.editBtnText}>Editar perfil</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Ciclo actual ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ciclo actual</Text>
          {cycleLoading && <ActivityIndicator size="small" color={Palette.primary} />}
          {cycleError && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{cycleError}</Text>
              <Pressable onPress={() => loadCycle()} style={styles.retrySmall}>
                <Text style={styles.retrySmallText}>Reintentar</Text>
              </Pressable>
            </View>
          )}
          {!cycleLoading && !cycleError && !cycle && (
            <View style={styles.card}>
              <Text style={styles.cardBody}>No tienes un ciclo activo.</Text>
            </View>
          )}
          {!cycleLoading && cycle && (
            <View style={styles.card}>
              <Text style={styles.cycleName}>{cycle.name}</Text>
              <View style={styles.cycleStats}>
                <View style={styles.cycleStat}>
                  <Text style={styles.cycleStatValue}>{cycleDay}</Text>
                  <Text style={styles.cycleStatLabel}>Día actual</Text>
                </View>
                <View style={styles.cycleDivider} />
                <View style={styles.cycleStat}>
                  <Text style={styles.cycleStatValue}>{cycleTotalDays}</Text>
                  <Text style={styles.cycleStatLabel}>Total días</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Inicio</Text>
                <Text style={styles.infoValue}>{formatDate(cycle.start_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fin</Text>
                <Text style={styles.infoValue}>{formatDate(cycle.end_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado</Text>
                <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>Activo</Text></View>
              </View>
            </View>
          )}
        </View>

        {/* ── Cuenta ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && !signingOut && styles.signOutBtnPressed, signingOut && styles.signOutBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            {signingOut ? <ActivityIndicator size="small" color={Palette.error} /> : <Text style={styles.signOutBtnText}>Cerrar sesión</Text>}
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit profile modal */}
      <EditProfileModal
        visible={editVisible}
        currentName={profile?.full_name ?? ''}
        currentTimezone={profile?.timezone ?? 'America/Bogota'}
        updateProfile={updateProfile}
        onClose={() => setEditVisible(false)}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Edit Profile Modal
// ---------------------------------------------------------------------------

interface EditProps {
  visible: boolean;
  currentName: string;
  currentTimezone: string;
  updateProfile: (input: { full_name?: string; timezone?: string }) => Promise<{ error: string | null }>;
  onClose: () => void;
}

function EditProfileModal({ visible, currentName, currentTimezone, updateProfile, onClose }: EditProps) {
  const [name, setName] = useState('');
  const [tz, setTz] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detect device timezone for suggestion
  const deviceTz = useRef<string>('');
  if (!deviceTz.current) {
    try { deviceTz.current = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
  }

  // Reset on open
  React.useEffect(() => {
    if (visible) {
      setName(currentName);
      setTz(currentTimezone);
      setError(null);
      setSaving(false);
    }
  }, [visible, currentName, currentTimezone]);

  const handleSave = useCallback(async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) { setError('El nombre es obligatorio.'); return; }
    const trimmedTz = tz.trim();
    if (!trimmedTz) { setError('La zona horaria es obligatoria.'); return; }
    if (!isValidTimezone(trimmedTz)) { setError('Zona horaria no válida. Ejemplo: America/Bogota.'); return; }

    setSaving(true);
    const { error: updateErr } = await updateProfile({ full_name: trimmedName, timezone: trimmedTz });
    setSaving(false);
    if (updateErr) { setError(updateErr); return; }
    onClose();
  }, [name, tz, updateProfile, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Editar perfil</Text>
              <Pressable onPress={onClose} disabled={saving}><Text style={styles.formCancel}>Cancelar</Text></Pressable>
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tu nombre" placeholderTextColor={Palette.textSecondary} autoCapitalize="words" editable={!saving} accessibilityLabel="Nombre completo" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Zona horaria</Text>
              <TextInput style={styles.input} value={tz} onChangeText={setTz} placeholder="America/Bogota" placeholderTextColor={Palette.textSecondary} autoCapitalize="none" autoCorrect={false} editable={!saving} accessibilityLabel="Zona horaria" />
              {deviceTz.current && deviceTz.current !== tz && (
                <Pressable onPress={() => setTz(deviceTz.current)} disabled={saving}>
                  <Text style={styles.suggestion}>Usar zona detectada: {deviceTz.current}</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]} accessibilityRole="button" accessibilityLabel="Guardar">
              {saving ? <ActivityIndicator color={Palette.textOnPrimary} size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: Palette.background },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl,
    maxWidth: Platform.OS === 'web' ? 680 : undefined,
    alignSelf: Platform.OS === 'web' ? 'center' : undefined,
    width: Platform.OS === 'web' ? '100%' : undefined,
  },
  header: { gap: 4, paddingTop: Spacing.sm },
  logo: { fontSize: 22, fontWeight: '800', color: Palette.primary, letterSpacing: -0.5 },
  title: { fontSize: 26, fontWeight: '700', color: Palette.textPrimary, marginTop: Spacing.xs },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Palette.textPrimary },

  card: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardBody: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center' },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 22, fontWeight: '700', color: Palette.textOnPrimary },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  userMeta: { fontSize: 13, color: Palette.textSecondary, marginTop: 2 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { fontSize: 13, color: Palette.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '500', color: Palette.textPrimary },

  editBtn: { height: 40, backgroundColor: Palette.primaryLight, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  editBtnPressed: { opacity: 0.7 },
  editBtnText: { fontSize: 14, fontWeight: '600', color: Palette.primary },

  // Cycle
  cycleName: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  cycleStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing.sm },
  cycleStat: { alignItems: 'center' },
  cycleStatValue: { fontSize: 24, fontWeight: '700', color: Palette.primary },
  cycleStatLabel: { fontSize: 12, color: Palette.textSecondary, marginTop: 2 },
  cycleDivider: { width: 1, height: 32, backgroundColor: Palette.border },
  statusBadge: { backgroundColor: Palette.completeLight, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { fontSize: 12, fontWeight: '600', color: Palette.complete },

  // Error
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  errorText: { fontSize: 13, color: Palette.error, flex: 1 },
  retrySmall: { paddingHorizontal: Spacing.sm, paddingVertical: 4, backgroundColor: Palette.primaryLight, borderRadius: Radius.sm },
  retrySmallText: { fontSize: 12, fontWeight: '600', color: Palette.primary },

  // Sign out
  signOutBtn: { height: 48, backgroundColor: Palette.errorLight, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  signOutBtnPressed: { opacity: 0.7 },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutBtnText: { fontSize: 16, fontWeight: '600', color: Palette.error },

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
  suggestion: { fontSize: 12, color: Palette.primary, marginTop: 4 },
  saveBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  saveBtnPressed: { backgroundColor: Palette.primaryDark },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },
});
