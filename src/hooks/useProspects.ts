import { useState, useEffect, useCallback, useRef } from 'react'
import { prospectsService, type ProspectFilters, type ProspectSort } from '@/services/prospects.service'
import type { ProspectRow } from '@/types/database'

interface UseProspectsParams {
  page: number
  limit?: number
  search?: string
  filters?: ProspectFilters
  sort?: ProspectSort
}

export function useProspects({
  page,
  limit = 20,
  search,
  filters,
  sort,
}: UseProspectsParams) {
  const [data, setData]   = useState<ProspectRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<Error | null>(null)

  // Stable serialized deps to avoid re-fetching on object identity changes
  const filterKey = JSON.stringify(filters)
  const sortKey   = JSON.stringify(sort)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await prospectsService.getProspects({
        page,
        limit,
        search,
        filters: filters,
        sort,
      })
      setData(result.data)
      setTotal(result.count)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load prospects'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, filterKey, sortKey])

  useEffect(() => { fetch() }, [fetch])

  const create = useCallback(async (payload: Parameters<typeof prospectsService.createProspect>[0]) => {
    const created = await prospectsService.createProspect(payload)
    setData(prev => [created, ...prev])
    setTotal(t => t + 1)
    return created
  }, [])

  const update = useCallback(async (id: number, updates: Parameters<typeof prospectsService.updateProspect>[1]) => {
    const updated = await prospectsService.updateProspect(id, updates)
    setData(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }, [])

  const remove = useCallback(async (id: number) => {
    await prospectsService.deleteProspect(id)
    setData(prev => prev.filter(p => p.id !== id))
    setTotal(t => t - 1)
  }, [])

  const bulkRemove = useCallback(async (ids: number[]) => {
    await prospectsService.bulkDeleteProspects(ids)
    setData(prev => prev.filter(p => !ids.includes(p.id)))
    setTotal(t => t - ids.length)
  }, [])

  return { data, total, loading, error, refetch: fetch, create, update, remove, bulkRemove }
}
