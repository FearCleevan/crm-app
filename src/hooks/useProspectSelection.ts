import { useState, useCallback } from 'react'

export function useProspectSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggle = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds])

  return { selectedIds, toggle, selectAll, clear, isSelected, count: selectedIds.size }
}
