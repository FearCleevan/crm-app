import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProspectSuggestion {
  id: number
  fullname: string | null
  firstname: string | null
  lastname: string | null
  email: string | null
  company: string | null
  jobtitle: string | null
  website: string | null
}

export function useProspectSearch(query: string, minChars = 2) {
  const [results, setResults] = useState<ProspectSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < minChars) {
      setResults([])
      setLoading(false)
      return
    }

    // Sanitize: remove PostgREST filter-breaking characters
    const safe = query.replace(/[,().]/g, ' ').trim()
    if (!safe) { setResults([]); return }

    let active = true
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const { data, error: sbError } = await supabase
        .from('prospects')
        .select('id, fullname, firstname, lastname, email, company, jobtitle, website')
        .or(`fullname.ilike.%${safe}%,email.ilike.%${safe}%,company.ilike.%${safe}%`)
        .eq('isactive', true)
        .not('email', 'is', null)
        .limit(6)

      if (active) {
        setError(sbError ? sbError.message : null)
        setResults(sbError ? [] : (data ?? []) as ProspectSuggestion[])
        setLoading(false)
      }
    }, 220)

    return () => {
      active = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, minChars])

  const clear = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return { results, loading, error, clear }
}
