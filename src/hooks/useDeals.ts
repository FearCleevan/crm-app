import { useState, useEffect, useCallback, useRef } from 'react'
import { dealsService, type DealFilters, type DealSort } from '@/services/deals.service'
import { supabase } from '@/lib/supabase'
import type { DealRow, DealInsert, DealUpdate, DealStage } from '@/types/database'

interface UseDealsParams {
  filters?: DealFilters
  sort?: DealSort
}

// Module-level cache — survives navigation, cleared on browser refresh
const cache = new Map<string, { data: DealRow[]; count: number }>()

export function useDeals({ filters, sort }: UseDealsParams = {}) {
  const filterKey = JSON.stringify(filters)
  const sortKey   = JSON.stringify(sort)
  const cacheKey  = JSON.stringify({ filterKey, sortKey })

  const cached = cache.get(cacheKey)
  const [data, setData]       = useState<DealRow[]>(() => cached?.data ?? [])
  const [total, setTotal]     = useState<number>(() => cached?.count ?? 0)
  const [loading, setLoading] = useState<boolean>(() => !cached)
  const [error, setError]     = useState<Error | null>(null)
  const aliveRef = useRef(true)

  const fetchDeals = useCallback(async () => {
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
      const result = await dealsService.getDeals({ filters, sort })
      if (!aliveRef.current) return
      cache.set(cacheKey, { data: result.data, count: result.count })
      setData(result.data)
      setTotal(result.count)
    } catch (err) {
      if (!aliveRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to load deals'))
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, sortKey, cacheKey])

  useEffect(() => {
    aliveRef.current = true
    fetchDeals()
    return () => { aliveRef.current = false }
  }, [fetchDeals])

  // ── Real-time subscription ────────────────────────────────────
  // Optimistic updates: apply changes to local state immediately so the
  // board reflects changes from other users without waiting for a refetch.
  useEffect(() => {
    const channel = supabase
      .channel('deals-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deals' },
        payload => {
          const newRow = payload.new as DealRow
          cache.clear()
          setData(prev => prev.some(d => d.id === newRow.id) ? prev : [newRow, ...prev])
          setTotal(t => t + 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deals' },
        payload => {
          const updated = payload.new as DealRow
          cache.clear()
          setData(prev => prev.map(d => d.id === updated.id ? updated : d))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'deals' },
        payload => {
          const deleted = payload.old as { id: string }
          cache.clear()
          setData(prev => prev.filter(d => d.id !== deleted.id))
          setTotal(t => Math.max(0, t - 1))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // mount once

  // ── Mutations ─────────────────────────────────────────────────
  const refetch = useCallback(() => {
    cache.delete(cacheKey)
    return fetchDeals()
  }, [cacheKey, fetchDeals])

  const create = useCallback(async (payload: DealInsert): Promise<DealRow> => {
    const created = await dealsService.createDeal(payload)
    cache.delete(cacheKey)
    setData(prev => [created, ...prev])
    setTotal(t => t + 1)
    return created
  }, [cacheKey])

  const update = useCallback(async (id: string, updates: DealUpdate): Promise<DealRow> => {
    const updated = await dealsService.updateDeal(id, updates)
    cache.delete(cacheKey)
    setData(prev => prev.map(d => d.id === id ? updated : d))
    return updated
  }, [cacheKey])

  const remove = useCallback(async (id: string): Promise<void> => {
    await dealsService.deleteDeal(id)
    cache.delete(cacheKey)
    setData(prev => prev.filter(d => d.id !== id))
    setTotal(t => t - 1)
  }, [cacheKey])

  const moveStage = useCallback(async (
    id: string,
    stage: DealStage,
    createdBy?: string | null,
  ): Promise<DealRow> => {
    const updated = await dealsService.moveStage(id, stage, createdBy)
    cache.delete(cacheKey)
    setData(prev => prev.map(d => d.id === id ? updated : d))
    return updated
  }, [cacheKey])

  const reorder = useCallback(async (ids: string[]): Promise<void> => {
    setData(prev => {
      const byId = Object.fromEntries(prev.map(d => [d.id, d]))
      const reordered = ids.map((id, i) => ({ ...byId[id], sort_order: i })).filter(Boolean) as DealRow[]
      const rest = prev.filter(d => !ids.includes(d.id))
      return [...reordered, ...rest]
    })
    cache.delete(cacheKey)
    await dealsService.reorderDeals(ids.map((id, i) => ({ id, sort_order: i })))
  }, [cacheKey])

  return { data, total, loading, error, refetch, create, update, remove, moveStage, reorder }
}
