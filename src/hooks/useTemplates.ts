import { useState, useEffect, useCallback } from 'react'
import {
  getTemplates, createTemplate, updateTemplate,
  softDeleteTemplate, duplicateTemplate,
} from '@/services/templateService'
import type { RichTemplateDB } from '@/types/campaigns'

export function useTemplates(createdBy: string | null) {
  const [templates, setTemplates] = useState<RichTemplateDB[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!createdBy) return
    setLoading(true)
    try {
      setTemplates(await getTemplates(createdBy))
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [createdBy])

  useEffect(() => { fetch() }, [fetch])

  return {
    templates,
    loading,
    error,
    refresh:   fetch,
    create:    async (data: Parameters<typeof createTemplate>[0]) => {
      const t = await createTemplate(data)
      await fetch()
      return t
    },
    update:    async (id: string, data: Parameters<typeof updateTemplate>[1]) => {
      await updateTemplate(id, data)
      await fetch()
    },
    remove:    async (id: string) => {
      await softDeleteTemplate(id)
      await fetch()
    },
    duplicate: async (id: string, createdByUser: string) => {
      const t = await duplicateTemplate(id, createdByUser)
      await fetch()
      return t
    },
  }
}
