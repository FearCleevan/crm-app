import { supabase } from '@/lib/supabase'
import type { ImportSessionRow } from '@/types/database'

export const importService = {
  async createSession(params: {
    session_id: string
    total_chunks: number
    total_prospects: number
    created_by: string
  }) {
    const { data, error } = await supabase
      .from('import_sessions')
      .insert(params)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ImportSessionRow
  },

  async getSession(session_id: string) {
    const { data, error } = await supabase
      .from('import_sessions')
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as ImportSessionRow | null
  },

  async getRecentSessions(limit = 20) {
    const { data, error } = await supabase
      .from('import_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []) as ImportSessionRow[]
  },
}
