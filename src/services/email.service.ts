import { supabase } from '@/lib/supabase'

interface SendEmailParams {
  to:       string | string[]
  cc?:      string | string[]
  bcc?:     string | string[]
  subject:  string
  html:     string
  threadId?: string
  prospectId?: number | null
}

interface ScheduleSendParams extends SendEmailParams {
  scheduledAt: string
  userId: string
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

export const emailService = {
  async send(params: SendEmailParams): Promise<{ statusUpdated: boolean }> {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params,
    })
    if (error) throw new Error(error.message ?? 'Failed to send email')
    return { statusUpdated: Boolean((data as { status_updated?: boolean } | null)?.status_updated) }
  },

  async scheduleSend(params: ScheduleSendParams): Promise<void> {
    const { error } = await supabase.from('scheduled_emails').insert({
      created_by:    params.userId,
      to_addresses:  toArray(params.to),
      cc_addresses:  toArray(params.cc),
      bcc_addresses: toArray(params.bcc),
      subject:       params.subject,
      html:          params.html,
      scheduled_at:  params.scheduledAt,
      status:        'pending',
    })
    if (error) throw new Error(error.message ?? 'Failed to schedule email')
  },
}
