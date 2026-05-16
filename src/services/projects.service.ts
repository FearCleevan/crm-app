import { supabase } from '@/lib/supabase'

export interface ProjectRow {
  id: string
  label: string
}

export const projectsService = {
  async getAll(userId: string): Promise<ProjectRow[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('id, label')
      .eq('user_id', userId)
      .order('sort_order')
      .order('created_at')
    if (error) throw error
    return (data ?? []) as ProjectRow[]
  },

  async create(userId: string, label: string): Promise<ProjectRow> {
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, label })
      .select('id, label')
      .single()
    if (error) throw error
    return data as ProjectRow
  },

  async rename(id: string, label: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ label, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },
}
