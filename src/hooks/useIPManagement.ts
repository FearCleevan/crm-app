import { useState, useEffect, useCallback } from 'react'
import { ipService } from '@/services/ip.service'
import type { IPEntryRow } from '@/types/database'

export function useIPManagement() {
  const [whitelist, setWhitelist] = useState<IPEntryRow[]>([])
  const [blacklist, setBlacklist] = useState<IPEntryRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [wl, bl] = await Promise.all([ipService.getWhitelist(), ipService.getBlacklist()])
      setWhitelist(wl)
      setBlacklist(bl)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load IP data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const addWhitelist = useCallback(async (ip: string, desc?: string) => {
    const entry = await ipService.addWhitelist(ip, desc)
    setWhitelist(prev => [entry, ...prev])
  }, [])

  const addBlacklist = useCallback(async (ip: string, desc?: string) => {
    const entry = await ipService.addBlacklist(ip, desc)
    setBlacklist(prev => [entry, ...prev])
  }, [])

  const removeWhitelist = useCallback(async (id: number) => {
    await ipService.removeWhitelist(id)
    setWhitelist(prev => prev.filter(e => e.id !== id))
  }, [])

  const removeBlacklist = useCallback(async (id: number) => {
    await ipService.removeBlacklist(id)
    setBlacklist(prev => prev.filter(e => e.id !== id))
  }, [])

  const toggleWhitelist = useCallback(async (id: number, is_active: boolean) => {
    const updated = await ipService.toggleWhitelist(id, is_active)
    setWhitelist(prev => prev.map(e => e.id === id ? updated : e))
  }, [])

  const toggleBlacklist = useCallback(async (id: number, is_active: boolean) => {
    const updated = await ipService.toggleBlacklist(id, is_active)
    setBlacklist(prev => prev.map(e => e.id === id ? updated : e))
  }, [])

  return {
    whitelist, blacklist, loading, error, refetch: fetch,
    addWhitelist, addBlacklist,
    removeWhitelist, removeBlacklist,
    toggleWhitelist, toggleBlacklist,
  }
}
