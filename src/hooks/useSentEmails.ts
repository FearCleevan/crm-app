import { useState, useEffect, useCallback } from 'react'
import { sentEmailsService } from '@/services/sentEmails.service'
import type { EmailMessage } from '@/constants/mockEmails'

const PAGE_SIZE = 25

export function useSentEmails() {
  const [emails, setEmails]   = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const { emails: rows, hasMore: more } = await sentEmailsService.listSent(p * PAGE_SIZE, 0)
      setHasMore(more)
      setEmails(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sent emails')
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(page) }, [load, page])

  function nextPage() {
    if (hasMore) setPage(p => p + 1)
  }

  function prevPage() {
    if (page > 1) setPage(p => p - 1)
  }

  function refresh() { load(page) }

  return { emails, loading, error, page, hasMore, nextPage, prevPage, refresh }
}
