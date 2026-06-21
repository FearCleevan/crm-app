import { useState, useEffect } from 'react'
import { getOutreachSettings, saveOutreachSettings } from '@/services/outreachSettingsService'
import type { OutreachSettings } from '@/types/campaigns'

const DEFAULTS: OutreachSettings = {
  sender_name:        'Peter Lazan',
  sender_email:       'peter@lazandev.dev',
  daily_limit:        50,
  send_from_hour:     9,
  send_to_hour:       17,
  send_days:          ['Mon','Tue','Wed','Thu','Fri'],
  warmup_enabled:     false,
  unsubscribe_footer: true,
  unsubscribe_text:   'To unsubscribe from these emails, reply with "unsubscribe".',
}

export function useOutreachSettings(userId: string | null) {
  const [settings, setSettings] = useState<OutreachSettings>(DEFAULTS)
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getOutreachSettings(userId)
      .then(s => { if (s) setSettings(s) })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [userId])

  async function save(updates: OutreachSettings): Promise<void> {
    if (!userId) return
    setSaving(true)
    try {
      await saveOutreachSettings(userId, updates)
      setSettings(updates)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
      throw e
    } finally {
      setSaving(false)
    }
  }

  return { settings, loading, saving, error, save }
}
