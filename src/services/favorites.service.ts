import { supabase } from '@/lib/supabase'

export interface FavoriteRow {
  id: string
  label: string
}

export const favoritesService = {
  async getAll(userId: string): Promise<FavoriteRow[]> {
    const { data, error } = await supabase
      .from('favorites')
      .select('id, label')
      .eq('user_id', userId)
      .order('sort_order')
      .order('created_at')
    if (error) throw error
    return (data ?? []) as FavoriteRow[]
  },

  async create(userId: string, label: string): Promise<FavoriteRow> {
    const { data, error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, label })
      .select('id, label')
      .single()
    if (error) throw error
    return data as FavoriteRow
  },

  async rename(id: string, label: string): Promise<void> {
    const { error } = await supabase.from('favorites').update({ label }).eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('favorites').delete().eq('id', id)
    if (error) throw error
  },
}
