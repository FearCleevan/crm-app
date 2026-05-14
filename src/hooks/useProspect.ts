import { useState, useEffect, useCallback } from 'react'
import { prospectsService } from '@/services/prospects.service'
import type { ProspectRow, ProspectUpdate } from '@/types/database'

export function useProspect(id: number | null) {
  const [data, setData]       = useState<ProspectRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<Error | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    prospectsService.getProspect(id)
      .then(p => { setData(p); setLoading(false) })
      .catch(err => { setError(err); setLoading(false) })
  }, [id])

  const update = useCallback(async (updates: ProspectUpdate) => {
    if (!id) return
    const updated = await prospectsService.updateProspect(id, updates)
    setData(updated)
    return updated
  }, [id])

  const remove = useCallback(async () => {
    if (!id) return
    await prospectsService.deleteProspect(id)
    setData(null)
  }, [id])

  return { data, loading, error, update, remove }
}
