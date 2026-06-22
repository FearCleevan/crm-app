import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProspectSuggestion {
  id: number
  fullname: string | null
  firstname: string | null
  lastname: string | null
  email: string | null
  company: string | null
}

export function useProspectSearch(query: string, minChars = 2) {
  const [results,  setResults]  = useState<ProspectSuggestion[]>([])
  const [loading,  setLoading]  = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < minChars) {
      setResults([])
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('prospects')
        .select('id, fullname, firstname, lastname, email, company')
        .or(`fullname.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
        .eq('isactive', true)
        .not('email', 'is', null)
        .limit(6)

      setResults((data as ProspectSuggestion[]) ?? [])
      setLoading(false)
    }, 220)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, minChars])

  function clear() { setResults([]) }

  return { results, loading, clear }
}
