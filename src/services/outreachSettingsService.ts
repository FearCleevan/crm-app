import { supabase } from '@/lib/supabase'
import type { OutreachSettings } from '@/types/campaigns'

export async function saveOutreachSettings(
  userId: string,
  settings: OutreachSettings
): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .upsert({
      user_id:        userId,
      provider:       'resend',
      label:          'Resend Email Outreach',
      config:         settings,
      status:         'active',
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })
  if (error) throw error
}

export async function getOutreachSettings(
  userId: string
): Promise<OutreachSettings | null> {
  const { data, error } = await supabase
    .from('integrations')
    .select('config')
    .eq('user_id', userId)
    .eq('provider', 'resend')
    .single()
  if (error) return null
  return (data?.config ?? null) as OutreachSettings | null
}

export async function saveSystemSetting(
  key: string,
  value: string,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key:   key,
      setting_value: value,
      updated_by:    updatedBy,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'setting_key' })
  if (error) throw error
}
