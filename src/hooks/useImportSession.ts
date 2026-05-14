import { useState, useEffect } from 'react'
import { importService } from '@/services/import.service'
import { supabase } from '@/lib/supabase'
import type { ImportSessionRow } from '@/types/database'

export function useImportSession(session_id: string | null) {
  const [session, setSession] = useState<ImportSessionRow | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session_id) return
    let mounted = true

    setLoading(true)
    importService.getSession(session_id).then(s => {
      if (mounted) { setSession(s); setLoading(false) }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Real-time progress updates
    const channel = supabase
      .channel(`import-${session_id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'import_sessions',
          filter: `session_id=eq.${session_id}` },
        ({ new: row }) => {
          if (mounted) setSession(row as ImportSessionRow)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [session_id])

  const progress = session && session.total_chunks > 0
    ? session.processed_chunks / session.total_chunks
    : 0

  return { session, loading, progress }
}
