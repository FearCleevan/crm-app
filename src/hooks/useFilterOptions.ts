import { useState, useEffect } from 'react'
import { prospectsService, type FilterOptions } from '@/services/prospects.service'

const EMPTY: FilterOptions = {
  dispositions: [], emailStatuses: [], providers: [],
  countries: [], industries: [], seniorities: [], departments: [], cities: [],
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    prospectsService.getFilterOptions()
      .then(data => { if (!cancelled) setOptions(data) })
      .catch(e  => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load filter options') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { options, loading, error }
}
