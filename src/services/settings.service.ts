import { supabase } from '@/lib/supabase'
import type { SystemSettingRow } from '@/types/database'

export const settingsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('setting_key')
    if (error) throw new Error(error.message)
    return (data ?? []) as SystemSettingRow[]
  },

  async get(key: string) {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('setting_key', key)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as SystemSettingRow | null
  },

  async upsert(key: string, value: string) {
    const { data, error } = await supabase
      .from('system_settings')
      .upsert(
        { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
        { onConflict: 'setting_key' }
      )
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as SystemSettingRow
  },
}
