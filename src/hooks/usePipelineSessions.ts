import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { pipelineSessionsService } from '@/services/pipelineSessions.service'
import type { PipelineSession } from '@/types/pipeline'

const PAGE_SIZE = 25

export function usePipelineSessions() {
  const [sessions, setSessions]   = useState<PipelineSession[]>([])
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [hasMore, setHasMore]     = useState(false)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      // Fetch one extra to determine hasMore
      const rows = await pipelineSessionsService.listSessions(p * PAGE_SIZE + 1)
      setHasMore(rows.length > p * PAGE_SIZE)
      setSessions(rows.slice(0, p * PAGE_SIZE))
    } catch {
      // silently fail — table may not exist yet in dev
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(page) }, [load, page])

  // Real-time: re-fetch whenever any row changes in pipeline_sessions
  useEffect(() => {
    const channel = supabase
      .channel('pipeline_sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pipeline_sessions' },
        () => { load(page) },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load, page])

  function nextPage() {
    if (hasMore) setPage(p => p + 1)
  }

  function prevPage() {
    if (page > 1) setPage(p => p - 1)
  }

  function refresh() { load(page) }

  return { sessions, loading, page, hasMore, nextPage, prevPage, refresh }
}
