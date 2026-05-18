import { supabase } from '@/lib/supabase'
import type { PipelineSession, PipelineSessionInsert, PipelineSessionUpdate } from '@/types/pipeline'

export const pipelineSessionsService = {

  async createSession(payload: PipelineSessionInsert): Promise<number> {
    const { data, error } = await supabase
      .from('pipeline_sessions')
      .insert(payload)
      .select('id')
      .single()

    if (error) throw new Error(`Failed to create pipeline session: ${error.message}`)
    return data.id
  },

  async updateSession(id: number, patch: PipelineSessionUpdate): Promise<void> {
    const { error } = await supabase
      .from('pipeline_sessions')
      .update(patch)
      .eq('id', id)

    if (error) throw new Error(`Failed to update pipeline session ${id}: ${error.message}`)
  },

  async listSessions(limit = 50): Promise<PipelineSession[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('pipeline_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to list pipeline sessions: ${error.message}`)
    return (data ?? []) as PipelineSession[]
  },

  async getSession(id: number): Promise<PipelineSession | null> {
    const { data, error } = await supabase
      .from('pipeline_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Failed to get pipeline session ${id}: ${error.message}`)
    return data as PipelineSession | null
  },
}
