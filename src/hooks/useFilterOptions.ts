import { useState, useEffect } from 'react'
import { prospectsService, type FilterOptions } from '@/services/prospects.service'

const EMPTY: FilterOptions = {
  dispositions: [], emailStatuses: [], providers: [],
  countries: [], industries: [], seniorities: [], departments: [], cities: [],
  jobtitles: [], companies: [],
}

// Module-level cache — survives re-renders and re-mounts for the session.
// Distinct filter values rarely change; re-fetching on every panel open
// wastes a round-trip on a 500k-row table.
let _cache: FilterOptions | null = null
let _promise: Promise<FilterOptions> | null = null

export function invalidateFilterCache() {
  _cache = null
  _promise = null
}

function fetchOnce(): Promise<FilterOptions> {
  if (_cache) return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = prospectsService.getFilterOptions().then(data => {
    _cache = data
    _promise = null
    return data
  })
  return _promise
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>(_cache ?? EMPTY)
  const [loading, setLoading] = useState(_cache === null)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (_cache) {
      setOptions(_cache)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchOnce()
      .then(data => { if (!cancelled) { setOptions(data); setLoading(false) } })
      .catch(e   => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load filter options'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return { options, loading, error }
}
