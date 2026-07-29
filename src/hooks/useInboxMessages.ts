import { useState, useEffect, useCallback } from 'react'
import { receivedEmailsService } from '@/services/receivedEmails.service'
import type { EmailMessage } from '@/constants/mockEmails'

const PAGE_SIZE = 25

export function useInboxMessages() {
  const [emails, setEmails]   = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const { emails: rows, hasMore: more } = await receivedEmailsService.listInbox(p * PAGE_SIZE, 0)
      setHasMore(more)
      setEmails(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox')
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

  async function toggleStar(id: string) {
    const email = emails.find(e => e.id === id)
    if (!email) return
    const next = !email.starred
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: next } : e))
    try {
      await receivedEmailsService.toggleStar(id, next)
    } catch {
      setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !next } : e))
    }
  }

  async function markRead(id: string) {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, read: true } : e))
    try {
      await receivedEmailsService.markRead(id, true)
    } catch {
      // non-critical, don't roll back read state over a failed background write
    }
  }

  async function remove(id: string) {
    setEmails(prev => prev.filter(e => e.id !== id))
    await receivedEmailsService.remove(id)
  }

  return { emails, loading, error, page, hasMore, nextPage, prevPage, refresh, toggleStar, markRead, remove }
}
