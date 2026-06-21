import { useState, useEffect, useCallback } from 'react'
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  launchCampaign, pauseCampaign, addRecipients, getRecipients,
} from '@/services/campaignService'
import type { Campaign, CampaignRecipient } from '@/types/campaigns'

export function useCampaigns(userId: string | null) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      setCampaigns(await getCampaigns(userId))
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return {
    campaigns,
    loading,
    error,
    refresh: fetch,
    create: async (data: Parameters<typeof createCampaign>[0]) => {
      const c = await createCampaign(data)
      await fetch()
      return c
    },
    update: async (id: string, data: Parameters<typeof updateCampaign>[1]) => {
      await updateCampaign(id, data)
      await fetch()
    },
    remove: async (id: string) => {
      await deleteCampaign(id)
      await fetch()
    },
    launch: async (id: string) => {
      await launchCampaign(id)
      await fetch()
    },
    pause: async (id: string) => {
      await pauseCampaign(id)
      await fetch()
    },
    addRecipients: async (campaignId: string, prospectIds: number[]) => {
      await addRecipients(campaignId, prospectIds)
      await fetch()
    },
    getRecipients: (campaignId: string): Promise<CampaignRecipient[]> =>
      getRecipients(campaignId),
  }
}
