import { useState, useEffect, useCallback } from 'react'
import { usersService } from '@/services/users.service'
import type { CRMUserRow } from '@/types/database'

export function useUsers() {
  const [data, setData]       = useState<CRMUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await usersService.getUsers())
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load users'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const updateRole = useCallback(async (id: string, role: CRMUserRow['role']) => {
    const updated = await usersService.updateRole(id, role)
    setData(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
    return updated
  }, [])

  const setActive = useCallback(async (id: string, is_active: boolean) => {
    const updated = await usersService.setActive(id, is_active)
    setData(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
    return updated
  }, [])

  const updateUser = useCallback(async (id: string, updates: Partial<CRMUserRow>) => {
    const updated = await usersService.updateUser(id, updates)
    setData(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
    return updated
  }, [])

  return { data, loading, error, refetch: fetch, updateRole, setActive, updateUser }
}
