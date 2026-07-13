import { supabase } from '@/lib/supabase'
import type { Campaign, CampaignRecipient } from '@/types/campaigns'

export async function getCampaigns(userId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*, email_templates(name, subject)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Campaign[]
}

export async function createCampaign(data: {
  user_id: string
  name: string
  description?: string
  template_id?: string
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
}): Promise<Campaign> {
  const { data: result, error } = await supabase
    .from('email_campaigns')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return result as Campaign
}

export async function updateCampaign(
  id: string,
  updates: Partial<Omit<Campaign, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function launchCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function pauseCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update({ status: 'paused' })
    .eq('id', id)
  if (error) throw error
}

export async function addRecipients(
  campaignId: string,
  prospectIds: number[]
): Promise<void> {
  const rows = prospectIds.map(pid => ({
    campaign_id: campaignId,
    prospect_id: pid,
    status:      'pending',
  }))
  const { error } = await supabase
    .from('campaign_recipients')
    .upsert(rows, { onConflict: 'campaign_id,prospect_id' })
  if (error) throw error
}

export async function addFilteredProspects(
  campaignId: string,
  filters: { country?: string; industry?: string; seniority?: string; limit?: number }
): Promise<number> {
  const { data, error } = await supabase.rpc('add_filtered_prospects_to_campaign', {
    p_campaign_id: campaignId,
    p_country:     filters.country   ?? null,
    p_industry:    filters.industry  ?? null,
    p_seniority:   filters.seniority ?? null,
    p_limit:       filters.limit     ?? 100,
  })
  if (error) throw error
  return data as number
}

export async function getRecipients(campaignId: string): Promise<CampaignRecipient[]> {
  const { data, error } = await supabase
    .from('campaign_recipients')
    .select(`
      *,
      prospects (
        id, fullname, firstname, lastname,
        email, company, jobtitle, country,
        status, seniority
      )
    `)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CampaignRecipient[]
}

export interface ProspectCampaignEvent {
  id: string
  type: 'sent' | 'opened' | 'clicked' | 'replied'
  occurredAt: string
  campaignName: string
}

export async function getProspectCampaignEvents(prospectId: number): Promise<ProspectCampaignEvent[]> {
  const { data, error } = await supabase
    .from('email_events')
    .select('id, event_type, occurred_at, email_campaigns(name)')
    .eq('prospect_id', prospectId)
    .in('event_type', ['sent', 'opened', 'clicked', 'replied'])
    .order('occurred_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    type: row.event_type as ProspectCampaignEvent['type'],
    occurredAt: row.occurred_at,
    campaignName: (row.email_campaigns as unknown as { name: string } | null)?.name ?? 'Campaign',
  }))
}
