import { useState, useEffect, useCallback } from 'react'
import { draftsService, type EmailDraft, type DraftInput } from '@/services/drafts.service'

export function useDrafts(userId: string | null) {
  const [drafts,  setDrafts]  = useState<EmailDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      setDrafts(await draftsService.listDrafts(userId))
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  async function saveDraft(input: Omit<DraftInput, 'user_id'>) {
    if (!userId) return
    await draftsService.createDraft({ ...input, user_id: userId })
    await refresh()
  }

  async function updateDraft(id: number, input: Partial<Omit<DraftInput, 'user_id'>>) {
    await draftsService.updateDraft(id, input)
    await refresh()
  }

  async function removeDraft(id: number) {
    await draftsService.deleteDraft(id)
    await refresh()
  }

  return { drafts, loading, error, refresh, saveDraft, updateDraft, removeDraft }
}
