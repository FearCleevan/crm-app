import { useState, useEffect, useCallback, useRef } from 'react'
import { prospectsService, type ProspectFilters, type ProspectSort } from '@/services/prospects.service'
import { supabase } from '@/lib/supabase'
import type { ProspectRow } from '@/types/database'

interface UseProspectsParams {
  page: number
  limit?: number
  search?: string
  filters?: ProspectFilters
  sort?: ProspectSort
}

// Module-level cache — survives navigation, cleared on browser refresh.
// Keyed by serialized params so each unique query has its own entry.
const cache = new Map<string, { data: ProspectRow[]; count: number }>()

export function useProspects({
  page,
  limit = 20,
  search,
  filters,
  sort,
}: UseProspectsParams) {
  const filterKey = JSON.stringify(filters)
  const sortKey   = JSON.stringify(sort)
  const cacheKey  = JSON.stringify({ page, limit, search, filterKey, sortKey })

  // Pre-populate from cache so navigating back shows data instantly (no loading flash)
  const [data, setData]       = useState<ProspectRow[]>(() => cache.get(cacheKey)?.data ?? [])
  const [total, setTotal]     = useState<number>(() => cache.get(cacheKey)?.count ?? 0)
  const [loading, setLoading] = useState<boolean>(() => !cache.has(cacheKey))
  const [error, setError]     = useState<Error | null>(null)

  const aliveRef = useRef(true)

  const fetchPage = useCallback(async () => {
    const hit = cache.get(cacheKey)
    if (hit) {
      setData(hit.data)
      setTotal(hit.count)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const result = await prospectsService.getProspects({ page, limit, search, filters, sort })
      if (!aliveRef.current) return
      cache.set(cacheKey, { data: result.data, count: result.count })
      setData(result.data)
      setTotal(result.count)
    } catch (err) {
      if (!aliveRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to load prospects'))
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, filterKey, sortKey, cacheKey])

  useEffect(() => {
    aliveRef.current = true
    fetchPage()
    return () => { aliveRef.current = false }
  }, [fetchPage])

  // ── Real-time subscription ────────────────────────────────────
  // Keep a ref to the latest fetchPage so the channel callback stays
  // stable and we don't recreate the channel on every param change.
  const fetchPageRef = useRef(fetchPage)
  useEffect(() => { fetchPageRef.current = fetchPage }, [fetchPage])

  useEffect(() => {
    const channel = supabase
      .channel('prospects-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prospects' },
        () => {
          // Invalidate every cached page and reload the current one
          cache.clear()
          fetchPageRef.current()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // mount once — channel is stable

  // ── Mutations ─────────────────────────────────────────────────
  const refetch = useCallback(() => {
    cache.delete(cacheKey)
    return fetchPage()
  }, [cacheKey, fetchPage])

  const create = useCallback(async (payload: Parameters<typeof prospectsService.createProspect>[0]) => {
    const created = await prospectsService.createProspect(payload)
    cache.delete(cacheKey)
    setData(prev => [created, ...prev])
    setTotal(t => t + 1)
    return created
  }, [cacheKey])

  const update = useCallback(async (id: number, updates: Parameters<typeof prospectsService.updateProspect>[1]) => {
    const updated = await prospectsService.updateProspect(id, updates)
    cache.delete(cacheKey)
    setData(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }, [cacheKey])

  const remove = useCallback(async (id: number) => {
    await prospectsService.deleteProspect(id)
    cache.delete(cacheKey)
    setData(prev => prev.filter(p => p.id !== id))
    setTotal(t => t - 1)
  }, [cacheKey])

  const bulkRemove = useCallback(async (ids: number[]) => {
    await prospectsService.bulkDeleteProspects(ids)
    cache.delete(cacheKey)
    setData(prev => prev.filter(p => !ids.includes(p.id)))
    setTotal(t => t - ids.length)
  }, [cacheKey])

  const bulkUpdateStatus = useCallback(async (ids: number[], status: ProspectRow['status']) => {
    await prospectsService.bulkUpdateStatus(ids, status)
    cache.delete(cacheKey)
    setData(prev => prev.map(p => ids.includes(p.id) ? { ...p, status } : p))
  }, [cacheKey])

  // Patches locally-held rows without a server round-trip — for when something else
  // (an edge function, a webhook) has already changed the row server-side and the
  // caller just needs the already-loaded list to reflect it immediately.
  const patchLocal = useCallback((id: number, patch: Partial<ProspectRow>) => {
    cache.delete(cacheKey)
    setData(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }, [cacheKey])

  return { data, total, loading, error, refetch, create, update, remove, bulkRemove, bulkUpdateStatus, patchLocal }
}
