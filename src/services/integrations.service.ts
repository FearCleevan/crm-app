import { supabase } from '@/lib/supabase'

export type IntegrationProvider = 'airtable' | 'mightcall' | 'gmail'
export type IntegrationStatus  = 'active' | 'inactive' | 'error'

export interface IntegrationRow {
  id: string
  user_id: string
  provider: IntegrationProvider
  label: string
  config: Record<string, string>
  status: IntegrationStatus
  last_synced_at: string | null
  created_at: string
}

export const integrationsService = {
  async getAll(userId: string): Promise<IntegrationRow[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('id, user_id, provider, label, config, status, last_synced_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as IntegrationRow[]
  },

  async connect(
    userId: string,
    provider: IntegrationProvider,
    label: string,
    config: Record<string, string>,
  ): Promise<IntegrationRow> {
    // Upsert by (user_id, provider) — only one connection per provider per user
    const { data, error } = await supabase
      .from('integrations')
      .upsert(
        { user_id: userId, provider, label, config, status: 'active' },
        { onConflict: 'user_id,provider' },
      )
      .select('id, user_id, provider, label, config, status, last_synced_at, created_at')
      .single()
    if (error) throw error
    return data as IntegrationRow
  },

  async disconnect(id: string): Promise<void> {
    const { error } = await supabase.from('integrations').delete().eq('id', id)
    if (error) throw error
  },

  async updateStatus(id: string, status: IntegrationStatus): Promise<void> {
    const { error } = await supabase.from('integrations').update({ status }).eq('id', id)
    if (error) throw error
  },

  async updateLastSynced(id: string): Promise<void> {
    const { error } = await supabase
      .from('integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },
}
