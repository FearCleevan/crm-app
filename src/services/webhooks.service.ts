import { supabase } from '@/lib/supabase'

export const WEBHOOK_EVENTS = [
  'prospect.created',
  'prospect.updated',
  'deal.created',
  'deal.stage_changed',
  'deal.closed',
  'email.sent',
  'user.invited',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

export interface WebhookRow {
  id: string
  user_id: string
  url: string
  events: WebhookEvent[]
  active: boolean
  created_at: string
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

export const webhooksService = {
  async getAll(userId: string): Promise<WebhookRow[]> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('id, user_id, url, events, active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as WebhookRow[]
  },

  // Returns the plaintext secret ONCE — used by the caller to show it to the user.
  async create(
    userId: string,
    url: string,
    events: WebhookEvent[],
  ): Promise<{ row: WebhookRow; secret: string }> {
    const secret = `whsec_${randomHex(32)}`

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert({ user_id: userId, url, events, secret, active: true })
      .select('id, user_id, url, events, active, created_at')
      .single()

    if (error) throw error
    return { row: data as WebhookRow, secret }
  },

  async update(id: string, patch: Partial<Pick<WebhookRow, 'url' | 'events' | 'active'>>): Promise<void> {
    const { error } = await supabase.from('webhook_endpoints').update(patch).eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)
    if (error) throw error
  },
}
