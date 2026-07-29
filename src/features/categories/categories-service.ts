/**
 * Categories service — CRUD operations for user categories.
 */

import { supabase } from '@/src/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/src/types/database';

export type Category = Tables<'categories'>;

export async function getAllCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  return { data: data ?? [], error };
}

export async function createCategory(
  userId: string,
  input: { name: string; color: string; icon: string | null },
) {
  // Get next position
  const { count } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      color: input.color,
      icon: input.icon,
      position: (count ?? 0),
      is_active: true,
    } satisfies TablesInsert<'categories'>)
    .select()
    .single();
  return { data, error };
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: { name?: string; color?: string; icon?: string | null },
) {
  const update: TablesUpdate<'categories'> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.color !== undefined) update.color = input.color;
  if (input.icon !== undefined) update.icon = input.icon;

  const { data, error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', categoryId)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

export async function deactivateCategory(userId: string, categoryId: string) {
  const { error } = await supabase
    .from('categories')
    .update({ is_active: false })
    .eq('id', categoryId)
    .eq('user_id', userId);
  return { error };
}

export async function reactivateCategory(userId: string, categoryId: string) {
  const { error } = await supabase
    .from('categories')
    .update({ is_active: true })
    .eq('id', categoryId)
    .eq('user_id', userId);
  return { error };
}

export async function categoryHasActivities(userId: string, categoryId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category_id', categoryId);
  if (error) return true; // Assume has activities on error
  return (count ?? 0) > 0;
}

export async function deleteCategory(userId: string, categoryId: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', userId);
  return { error };
}
