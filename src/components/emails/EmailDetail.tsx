import { useState, useEffect } from 'react'
import { Reply, Forward, Trash2, Archive, Star, Paperclip, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmailMessage } from '@/constants/mockEmails'
import { InlineReplyBox } from './InlineReplyBox'

interface EmailDetailProps {
  email: EmailMessage
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
}

export function EmailDetail({ email, onDelete, onToggleStar }: EmailDetailProps) {
  const [replying, setReplying] = useState(false)

  // Close any open reply box when switching to a different email
  useEffect(() => { setReplying(false) }, [email.id])

  const dateFormatted = new Date(email.date).toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const replySubject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-border shrink-0">
        <button type="button" onClick={() => setReplying(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
          <Reply className="h-3.5 w-3.5" /> Reply
        </button>
        <button type="button"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
          <Forward className="h-3.5 w-3.5" /> Forward
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => onToggleStar(email.id)} aria-label="Star"
          className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
          <Star className={cn('h-4 w-4', email.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
        </button>
        <button type="button" aria-label="Archive"
          className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
          <Archive className="h-4 w-4 text-muted-foreground" />
        </button>
        <button type="button" onClick={() => onDelete(email.id)} aria-label="Delete"
          className="h-8 w-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors">
          <Trash2 className="h-4 w-4 text-rose-500" />
        </button>
        <button type="button" aria-label="More options"
          className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Subject */}
        <h2 className="text-xl font-bold text-foreground mb-4">{email.subject}</h2>

        {/* Sender info */}
        <div className="flex items-start gap-3 mb-5 pb-5 border-b border-border">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {email.from.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{email.from.name}</span>
              <span className="text-xs text-muted-foreground">&lt;{email.from.email}&gt;</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              To: {email.to.map(t => t.email).join(', ')}
              {email.cc && ` · Cc: ${email.cc.map(c => c.email).join(', ')}`}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{dateFormatted}</div>
          </div>
        </div>

        {/* Body */}
        <div
          className="prose prose-sm max-w-none text-foreground [&_a]:text-brand-500 [&_a]:hover:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> {email.attachments.length} Attachment{email.attachments.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map(att => (
                <div key={att.name}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-accent cursor-pointer transition-colors">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{att.name}</p>
                    <p className="text-[11px] text-muted-foreground">{att.size}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reply area — inline composer once active, matching Gmail's own thread reply UX */}
      {replying ? (
        <InlineReplyBox
          toEmail={email.from.email}
          toName={email.from.name}
          subject={replySubject}
          onSent={() => setReplying(false)}
          onCancel={() => setReplying(false)}
        />
      ) : (
        <div className="shrink-0 border-t border-border px-6 py-4">
          <button type="button" onClick={() => setReplying(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/20 hover:bg-accent text-sm text-muted-foreground text-left transition-colors">
            <Reply className="h-4 w-4 shrink-0" />
            Reply to {email.from.name}…
          </button>
        </div>
      )}
    </div>
  )
}
