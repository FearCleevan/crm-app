import { supabase } from '@/lib/supabase'
import type { IPEntryRow } from '@/types/database'

export const ipService = {
  async getWhitelist() {
    const { data, error } = await supabase
      .from('ip_whitelist')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as IPEntryRow[]
  },

  async getBlacklist() {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as IPEntryRow[]
  },

  async addWhitelist(ip_address: string, description?: string) {
    const { data, error } = await supabase
      .from('ip_whitelist')
      .insert({ ip_address, description: description ?? null })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as IPEntryRow
  },

  async addBlacklist(ip_address: string, description?: string) {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .insert({ ip_address, description: description ?? null })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as IPEntryRow
  },

  async removeWhitelist(id: number) {
    const { error } = await supabase.from('ip_whitelist').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async removeBlacklist(id: number) {
    const { error } = await supabase.from('ip_blacklist').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async toggleWhitelist(id: number, is_active: boolean) {
    const { data, error } = await supabase
      .from('ip_whitelist')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as IPEntryRow
  },

  async toggleBlacklist(id: number, is_active: boolean) {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as IPEntryRow
  },

  async checkCurrentIP(): Promise<{ allowed: boolean; ip: string; reason?: string }> {
    const { data, error } = await supabase.functions.invoke('ip-validator')
    if (error) throw new Error(error.message)
    return data as { allowed: boolean; ip: string; reason?: string }
  },
}
