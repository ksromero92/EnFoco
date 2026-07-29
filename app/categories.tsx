/**
 * Categories screen — full CRUD for user categories.
 * Accessed from Rutinas via "Gestionar categorías".
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/AuthProvider';
import {
  categoryHasActivities,
  createCategory,
  deactivateCategory,
  deleteCategory,
  getAllCategories,
  reactivateCategory,
  updateCategory,
} from '@/src/features/categories/categories-service';
import type { Category } from '@/src/features/categories/categories-service';
import { AVAILABLE_ICONS, CategoryIcon, getIconName } from '@/src/components/categories/CategoryIcon';

// ---------------------------------------------------------------------------
// Color palette for selection
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  '#2563EB', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899',
  '#06B6D4', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#78716C',
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CategoriesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Form
  const [formVisible, setFormVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Action menu
  const [actionCategory, setActionCategory] = useState<Category | null>(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasMounted = useRef(false);

  const activeCategories = useMemo(() => allCategories.filter((c) => c.is_active), [allCategories]);
  const inactiveCategories = useMemo(() => allCategories.filter((c) => !c.is_active), [allCategories]);

  // ─── Load ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);

    const { data, error: err } = await getAllCategories(user.id);
    if (err) { if (!silent) setError('No se pudieron cargar las categorías.'); }
    else { setAllCategories(data); }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (hasMounted.current) { loadData({ silent: true }); }
      else { hasMounted.current = true; loadData(); }
    }, [loadData]),
  );

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleDeactivate = useCallback(async (cat: Category) => {
    if (!user || actionProcessing) return;
    setActionProcessing(true); setActionError(null);
    const { error: err } = await deactivateCategory(user.id, cat.id);
    if (err) { setActionError('No se pudo desactivar.'); setActionProcessing(false); return; }
    await loadData({ silent: true });
    setActionProcessing(false); setActionCategory(null);
  }, [user, actionProcessing, loadData]);

  const handleReactivate = useCallback(async (cat: Category) => {
    if (!user || actionProcessing) return;
    setActionProcessing(true); setActionError(null);
    const { error: err } = await reactivateCategory(user.id, cat.id);
    if (err) { setActionError('No se pudo reactivar.'); setActionProcessing(false); return; }
    await loadData({ silent: true });
    setActionProcessing(false); setActionCategory(null);
    setShowInactive(false);
  }, [user, actionProcessing, loadData]);

  const handleDelete = useCallback(async (cat: Category) => {
    if (!user || actionProcessing) return;
    setActionProcessing(true); setActionError(null);

    const hasActs = await categoryHasActivities(user.id, cat.id);
    if (hasActs) {
      setActionError('Esta categoría está siendo usada por actividades y no puede eliminarse. Puedes mantenerla desactivada.');
      setActionProcessing(false); return;
    }

    const { error: err } = await deleteCategory(user.id, cat.id);
    if (err) { setActionError('No se pudo eliminar.'); setActionProcessing(false); return; }
    await loadData({ silent: true });
    setActionProcessing(false); setActionCategory(null);
    // If no more inactive, switch back
    if (showInactive && inactiveCategories.length <= 1) setShowInactive(false);
  }, [user, actionProcessing, loadData, showInactive, inactiveCategories.length]);

  const handleEdit = useCallback((cat: Category) => {
    setActionCategory(null);
    setEditingCategory(cat);
    setFormVisible(true);
  }, []);

  const handleFormClose = useCallback(() => { setFormVisible(false); setEditingCategory(null); }, []);

  const handleFormSaved = useCallback(async () => {
    handleFormClose();
    await loadData({ silent: true });
  }, [handleFormClose, loadData]);

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
          <Text style={styles.title}>Categorías</Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Tabs */}
        {inactiveCategories.length > 0 && (
          <View style={styles.tabRow}>
            <Pressable onPress={() => setShowInactive(false)} style={[styles.tab, !showInactive && styles.tabActive]}>
              <Text style={[styles.tabText, !showInactive && styles.tabTextActive]}>Activas ({activeCategories.length})</Text>
            </Pressable>
            <Pressable onPress={() => setShowInactive(true)} style={[styles.tab, showInactive && styles.tabActive]}>
              <Text style={[styles.tabText, showInactive && styles.tabTextActive]}>Inactivas ({inactiveCategories.length})</Text>
            </Pressable>
          </View>
        )}

        {/* List */}
        {(!showInactive ? activeCategories : inactiveCategories).map((cat) => (
          <Pressable key={cat.id} onPress={() => setActionCategory(cat)} style={[styles.catRow, !cat.is_active && styles.catRowInactive]}>
            <CategoryIcon icon={cat.icon} color={cat.color} size={40} />
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{cat.name}</Text>
              <Text style={styles.catMeta}>{cat.color}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        {!showInactive && activeCategories.length === 0 && (
          <Text style={styles.emptyText}>No tienes categorías activas.</Text>
        )}
        {showInactive && inactiveCategories.length === 0 && (
          <Text style={styles.emptyText}>No tienes categorías inactivas.</Text>
        )}

        {/* New button */}
        {!showInactive && (
          <Pressable
            onPress={() => { setEditingCategory(null); setFormVisible(true); }}
            style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.newBtnText}>+ Nueva categoría</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Action menu */}
      {actionCategory && (
        <Modal visible animationType="fade" transparent>
          <Pressable style={styles.overlay} onPress={!actionProcessing ? () => { setActionCategory(null); setActionError(null); } : undefined}>
            <View style={styles.actionCard}>
              <CategoryIcon icon={actionCategory.icon} color={actionCategory.color} size={44} />
              <Text style={styles.actionTitle}>{actionCategory.name}</Text>
              {actionError && <Text style={styles.actionError}>{actionError}</Text>}
              {actionProcessing && <ActivityIndicator size="small" color={Palette.primary} />}
              {!actionProcessing && actionCategory.is_active && (
                <>
                  <Pressable onPress={() => handleEdit(actionCategory)} style={styles.actionBtn}><Text style={styles.actionBtnText}>Editar</Text></Pressable>
                  <Pressable onPress={() => handleDeactivate(actionCategory)} style={styles.actionBtn}><Text style={styles.actionBtnText}>Desactivar</Text></Pressable>
                  <Pressable onPress={() => handleDelete(actionCategory)} style={[styles.actionBtn, styles.actionBtnDanger]}><Text style={styles.actionBtnTextDanger}>Eliminar</Text></Pressable>
                </>
              )}
              {!actionProcessing && !actionCategory.is_active && (
                <>
                  <Pressable onPress={() => handleReactivate(actionCategory)} style={styles.actionBtn}><Text style={styles.actionBtnText}>Reactivar</Text></Pressable>
                  <Pressable onPress={() => handleDelete(actionCategory)} style={[styles.actionBtn, styles.actionBtnDanger]}><Text style={styles.actionBtnTextDanger}>Eliminar</Text></Pressable>
                </>
              )}
              {!actionProcessing && (
                <Pressable onPress={() => { setActionCategory(null); setActionError(null); }} style={styles.actionBtn}><Text style={[styles.actionBtnText, { color: Palette.textSecondary }]}>Cancelar</Text></Pressable>
              )}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Form */}
      <CategoryForm visible={formVisible} editing={editingCategory} userId={user?.id ?? ''} onClose={handleFormClose} onSaved={handleFormSaved} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Category Form
// ---------------------------------------------------------------------------

interface FormProps { visible: boolean; editing: Category | null; userId: string; onClose: () => void; onSaved: () => void; }

function CategoryForm({ visible, editing, userId, onClose, onSaved }: FormProps) {
  const isEditing = editing !== null;
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]!);
  const [icon, setIcon] = useState<string>(AVAILABLE_ICONS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setError(null); setSaving(false);
      if (editing) {
        setName(editing.name);
        setColor(editing.color);
        setIcon(editing.icon ?? AVAILABLE_ICONS[0]!);
      } else {
        setName(''); setColor(COLOR_PALETTE[0]!); setIcon(AVAILABLE_ICONS[0]!);
      }
    }
  }, [visible, editing]);

  // Include editing color if not in palette
  const colorOptions = useMemo(() => {
    if (editing && !COLOR_PALETTE.includes(editing.color)) {
      return [editing.color, ...COLOR_PALETTE];
    }
    return COLOR_PALETTE;
  }, [editing]);

  const handleSave = useCallback(async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) { setError('El nombre es obligatorio.'); return; }

    setSaving(true);
    if (isEditing && editing) {
      const { error: err } = await updateCategory(userId, editing.id, { name: trimmed, color: color.toUpperCase(), icon });
      if (err) {
        const msg = err.message?.includes('idx_categories_unique_name_per_user') ? 'Ya existe una categoría con ese nombre.' : 'No se pudo guardar.';
        setError(msg); setSaving(false); return;
      }
    } else {
      const { error: err } = await createCategory(userId, { name: trimmed, color: color.toUpperCase(), icon });
      if (err) {
        const msg = err.message?.includes('idx_categories_unique_name_per_user') ? 'Ya existe una categoría con ese nombre.' : 'No se pudo crear la categoría.';
        setError(msg); setSaving(false); return;
      }
    }
    setSaving(false);
    onSaved();
  }, [name, color, icon, isEditing, editing, userId, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{isEditing ? 'Editar categoría' : 'Nueva categoría'}</Text>
            <Pressable onPress={onClose} disabled={saving}><Text style={styles.formCancel}>Cancelar</Text></Pressable>
          </View>

          {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>{error}</Text></View>}

          {/* Preview */}
          <View style={styles.previewRow}>
            <CategoryIcon icon={icon} color={color} size={52} />
            <Text style={[styles.previewName, { color }]}>{name.trim() || 'Categoría'}</Text>
          </View>

          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={Palette.textSecondary} editable={!saving} accessibilityLabel="Nombre" />
          </View>

          {/* Color */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorGrid}>
              {colorOptions.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)} disabled={saving} style={[styles.colorCircle, { backgroundColor: c }, color === c && styles.colorCircleSelected]}>
                  {color === c && <MaterialIcons name="check" size={16} color="#FFF" />}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Icon */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Icono</Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map((key) => (
                <Pressable key={key} onPress={() => setIcon(key)} disabled={saving} style={[styles.iconCell, icon === key && { backgroundColor: color + '22', borderColor: color }]}>
                  <MaterialIcons name={getIconName(key) as keyof typeof MaterialIcons.glyphMap} size={20} color={icon === key ? color : Palette.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && !saving && styles.saveBtnPressed, saving && styles.saveBtnDisabled]} accessibilityRole="button">
            {saving ? <ActivityIndicator color={Palette.textOnPrimary} size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
          </Pressable>
        </ScrollView>
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

  tabRow: { flexDirection: 'row', gap: Spacing.sm },
  tab: { flex: 1, height: 36, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  tabActive: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Palette.textSecondary },
  tabTextActive: { color: Palette.primary },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  catRowInactive: { opacity: 0.6 },
  catInfo: { flex: 1, gap: 2 },
  catName: { fontSize: 15, fontWeight: '600', color: Palette.textPrimary },
  catMeta: { fontSize: 12, color: Palette.textSecondary },
  chevron: { fontSize: 20, color: Palette.textSecondary },
  emptyText: { fontSize: 14, color: Palette.textSecondary, textAlign: 'center', paddingVertical: Spacing.lg },

  newBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  newBtnPressed: { backgroundColor: Palette.primaryDark },
  newBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  actionCard: { backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 320, gap: Spacing.sm, alignItems: 'center' },
  actionTitle: { fontSize: 17, fontWeight: '700', color: Palette.textPrimary },
  actionError: { fontSize: 13, color: Palette.error, textAlign: 'center', lineHeight: 18 },
  actionBtn: { width: '100%', height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  actionBtnText: { fontSize: 15, fontWeight: '500', color: Palette.textPrimary },
  actionBtnDanger: { borderColor: Palette.errorLight, backgroundColor: Palette.errorLight },
  actionBtnTextDanger: { fontSize: 15, fontWeight: '500', color: Palette.error },

  formScroll: { padding: Spacing.lg, gap: Spacing.md, maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: Platform.OS === 'web' ? 'center' : undefined, width: Platform.OS === 'web' ? '100%' : undefined, paddingBottom: Spacing.xxl },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { fontSize: 20, fontWeight: '700', color: Palette.textPrimary },
  formCancel: { fontSize: 15, color: Palette.primary, fontWeight: '500' },
  errorBox: { backgroundColor: Palette.errorLight, borderRadius: Radius.sm, padding: Spacing.sm },
  errorBoxText: { fontSize: 14, color: Palette.error, textAlign: 'center' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, justifyContent: 'center', paddingVertical: Spacing.sm },
  previewName: { fontSize: 18, fontWeight: '700' },
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '500', color: Palette.textPrimary },
  input: { height: 48, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, fontSize: 16, color: Palette.textPrimary, backgroundColor: Palette.surface },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorCircleSelected: { borderWidth: 3, borderColor: Palette.textPrimary },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconCell: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  saveBtn: { height: 48, backgroundColor: Palette.primary, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  saveBtnPressed: { backgroundColor: Palette.primaryDark },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: Palette.textOnPrimary },
});
