import { supabase } from '@/lib/supabase'
import type { EmailMessage } from '@/constants/mockEmails'

// Merges the two real sources of thread history into one chronological conversation:
// - received_emails (inbound replies, synced by gmail-sync, keyed by Gmail's own thread id)
// - activities (real sent emails, type='email' with email_to set, keyed by whatever thread_id
//   they were sent against — see 026_activities_thread_id.sql; sent mail never touches Gmail
//   directly, so it has no Gmail-assigned thread id of its own)

interface ReceivedRow {
  id: string
  from_email: string
  from_name: string | null
  to_email: string | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  snippet: string | null
  received_at: string
}

interface SentRow {
  id: string
  title: string
  description: string | null
  email_to: string | null
  email_body: string | null
  created_at: string
  crm_users: { first_name: string | null; last_name: string | null; email: string | null } | null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export const emailThreadService = {
  async getThread(threadId: string): Promise<EmailMessage[]> {
    const [receivedRes, sentRes] = await Promise.all([
      supabase
        .from('received_emails')
        .select('id, from_email, from_name, to_email, subject, body_html, body_text, snippet, received_at')
        .eq('gmail_thread_id', threadId)
        .order('received_at', { ascending: true }),
      supabase
        .from('activities')
        .select('id, title, description, email_to, email_body, created_at, crm_users!created_by(first_name, last_name, email)')
        .eq('type', 'email')
        .eq('thread_id', threadId)
        .not('email_to', 'is', null)
        .order('created_at', { ascending: true }),
    ])

    if (receivedRes.error) throw new Error(receivedRes.error.message)
    if (sentRes.error) throw new Error(sentRes.error.message)

    const received: EmailMessage[] = ((receivedRes.data ?? []) as ReceivedRow[]).map(row => {
      const body = row.body_html || (row.body_text ? `<p>${row.body_text}</p>` : '<p><em>(no content)</em></p>')
      return {
        id: row.id,
        folder: 'inbox',
        threadId,
        from: { name: row.from_name || row.from_email, email: row.from_email },
        to: [{ name: '', email: row.to_email ?? '' }],
        subject: row.subject || '(no subject)',
        preview: (row.snippet || stripHtml(body)).slice(0, 140),
        body,
        date: row.received_at,
        read: true,
        starred: false,
        hasAttachment: false,
      }
    })

    const sent: EmailMessage[] = ((sentRes.data ?? []) as unknown as SentRow[]).map(row => {
      const fromName = `${row.crm_users?.first_name ?? ''} ${row.crm_users?.last_name ?? ''}`.trim() || 'Me'
      const body = row.email_body ?? `<p><em>${row.description ?? ''}</em></p>`
      return {
        id: row.id,
        folder: 'sent',
        threadId,
        from: { name: fromName, email: row.crm_users?.email ?? '' },
        to: (row.email_to ?? '').split(',').map(e => e.trim()).filter(Boolean).map(email => ({ name: '', email })),
        subject: row.title,
        preview: stripHtml(body).slice(0, 140),
        body,
        date: row.created_at,
        read: true,
        starred: false,
        hasAttachment: false,
      }
    })

    return [...received, ...sent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  },
}
