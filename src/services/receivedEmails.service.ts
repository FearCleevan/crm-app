import { supabase } from '@/lib/supabase'
import type { EmailMessage } from '@/constants/mockEmails'

// Phase 4 of EMAIL_INBOX_SENT_DRAFTS_FRONTEND_IMPLEMENTATION.md.
// Reads from `received_emails`, populated by the gmail-sync Edge Function (Phase 3b/3c) —
// only messages that matched a real prospect's email ever land there.

interface ReceivedEmailRow {
  id: string
  from_email: string
  from_name: string | null
  to_email: string | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  snippet: string | null
  received_at: string
  is_read: boolean
  is_starred: boolean
}

export interface InboxPage {
  emails: EmailMessage[]
  hasMore: boolean
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// "Name" <email@example.com>, "Name2" <email2@example.com> -> [{ name, email }, ...]
function parseAddressList(raw: string | null): { name: string; email: string }[] {
  if (!raw?.trim()) return []
  return raw.split(',').map(part => {
    const match = part.trim().match(/^"?([^"<]*)"?\s*<(.+)>$/)
    if (match) return { name: match[1].trim(), email: match[2].trim() }
    return { name: '', email: part.trim() }
  }).filter(a => a.email)
}

export const receivedEmailsService = {
  async listInbox(limit: number, offset: number): Promise<InboxPage> {
    const { data, error } = await supabase
      .from('received_emails')
      .select('id, from_email, from_name, to_email, subject, body_html, body_text, snippet, received_at, is_read, is_starred')
      .order('received_at', { ascending: false })
      .range(offset, offset + limit)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as ReceivedEmailRow[]
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)

    const emails: EmailMessage[] = page.map(row => {
      const body = row.body_html || (row.body_text ? `<p>${row.body_text}</p>` : '<p><em>(no content)</em></p>')
      return {
        id: row.id,
        folder: 'inbox',
        from: { name: row.from_name || row.from_email, email: row.from_email },
        to: parseAddressList(row.to_email).length > 0 ? parseAddressList(row.to_email) : [{ name: '', email: '(unknown)' }],
        subject: row.subject || '(no subject)',
        preview: (row.snippet || stripHtml(body)).slice(0, 140),
        body,
        date: row.received_at,
        read: row.is_read,
        starred: row.is_starred,
        hasAttachment: false,
      }
    })

    return { emails, hasMore }
  },

  async markRead(id: string, read: boolean): Promise<void> {
    const { error } = await supabase.from('received_emails').update({ is_read: read }).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async toggleStar(id: string, starred: boolean): Promise<void> {
    const { error } = await supabase.from('received_emails').update({ is_starred: starred }).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('received_emails').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
