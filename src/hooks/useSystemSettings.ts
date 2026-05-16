import { useState, useEffect, useCallback } from 'react'
import { settingsService } from '@/services/settings.service'
import type { SystemSettingRow } from '@/types/database'

export function useSystemSettings() {
  const [data, setData]       = useState<SystemSettingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await settingsService.getAll())
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load settings'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const upsert = useCallback(async (key: string, value: string) => {
    const updated = await settingsService.upsert(key, value)
    setData(prev => {
      const exists = prev.some(s => s.setting_key === key)
      return exists
        ? prev.map(s => s.setting_key === key ? updated : s)
        : [...prev, updated]
    })
    return updated
  }, [])

  const getValue = useCallback((key: string) =>
    data.find(s => s.setting_key === key)?.setting_value ?? null,
  [data])

  return { data, loading, error, refetch: fetch, upsert, getValue }
}
