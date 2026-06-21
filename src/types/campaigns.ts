export interface Campaign {
  id: string
  user_id: string
  name: string
  description: string | null
  template_id: string | null
  status: 'draft' | 'active' | 'paused' | 'completed'
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
  total_recipients: number
  total_sent: number
  total_opened: number
  total_clicked: number
  total_replied: number
  total_bounced: number
  total_unsubscribed: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined relations — only present when selected with a join
  email_templates?: { name: string; subject: string } | null
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  prospect_id: number   // bigint in DB → number in TypeScript
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
  resend_message_id: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  bounced_at: string | null
  unsubscribed_at: string | null
  created_at: string
  // Joined
  prospects?: {
    id: number
    fullname: string | null
    firstname: string | null
    lastname: string | null
    email: string | null
    company: string | null
    jobtitle: string | null
    country: string | null
    status: string | null
    seniority: string | null
  } | null
}

export interface EmailEvent {
  id: string
  campaign_id: string | null
  recipient_id: string | null
  prospect_id: number | null  // bigint → number
  event_type: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
  event_data: Record<string, unknown>
  occurred_at: string
}

export interface OutreachSettings {
  sender_name: string
  sender_email: string
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
  unsubscribe_footer: boolean
  unsubscribe_text: string
}

export interface RichTemplateDB {
  id: string
  name: string
  category: string
  subject: string
  body: string
  variables: string[]
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string | null
}
