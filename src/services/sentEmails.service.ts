import { supabase } from '@/lib/supabase'
import type { EmailMessage } from '@/constants/mockEmails'

// Phase 1 of EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md.
// All three real send paths (send_outreach_email, send-campaign-batch,
// send-scheduled-emails) already converge on `activities` (type = 'email'),
// so Sent is a single query here — no union with campaign_recipients
// needed, since campaign sends log to activities too.

interface SentActivityRow {
  id: string
  title: string
  description: string | null
  email_to: string | null
  email_body: string | null
  created_at: string
  crm_users: { first_name: string | null; last_name: string | null; email: string | null } | null
}

export interface SentEmailsPage {
  emails: EmailMessage[]
  hasMore: boolean
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export const sentEmailsService = {
  async listSent(limit: number, offset: number): Promise<SentEmailsPage> {
    const { data, error } = await supabase
      .from('activities')
      .select('id, title, description, email_to, email_body, created_at, crm_users!created_by(first_name, last_name, email)')
      .eq('type', 'email')
      // Real sends always set email_to (Phase 1 fix). Event-log rows sharing type='email' --
      // resend-webhook's opens/clicks, gmail-sync's "Email replied" -- never do, so this
      // excludes them from showing up here as if they were something the user sent.
      .not('email_to', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as unknown as SentActivityRow[]
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)

    const emails: EmailMessage[] = page.map(row => {
      const fromName = `${row.crm_users?.first_name ?? ''} ${row.crm_users?.last_name ?? ''}`.trim() || 'Me'
      const toEmails = (row.email_to ?? '').split(',').map(e => e.trim()).filter(Boolean)
      const body = row.email_body ?? `<p><em>${row.description ?? 'Content not available for this send.'}</em></p>`

      return {
        id: row.id,
        folder: 'sent',
        from: { name: fromName, email: row.crm_users?.email ?? '' },
        to: toEmails.length > 0 ? toEmails.map(email => ({ name: '', email })) : [{ name: '', email: '(unknown)' }],
        subject: row.title,
        preview: stripHtml(body).slice(0, 140),
        body,
        date: row.created_at,
        read: true,
        starred: false,
        hasAttachment: false,
      }
    })

    return { emails, hasMore }
  },
}
