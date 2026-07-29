import { useState, useEffect, useCallback } from 'react'
import { Reply, Forward, Trash2, Archive, Star, Paperclip, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmailMessage } from '@/constants/mockEmails'
import { emailThreadService } from '@/services/emailThread.service'
import { InlineReplyBox } from './InlineReplyBox'

interface EmailDetailProps {
  email: EmailMessage
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
}

function MessageCard({ message }: { message: EmailMessage }) {
  const dateFormatted = new Date(message.date).toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const isSent = message.folder === 'sent'

  return (
    <div className={cn('rounded-xl border p-5', isSent ? 'border-brand-200 dark:border-brand-800/40 bg-brand-50/40 dark:bg-brand-900/10' : 'border-border bg-card')}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
          isSent ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-brand-400 to-brand-600',
        )}>
          {message.from.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{message.from.name}</span>
            {isSent && <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">You replied</span>}
            <span className="text-xs text-muted-foreground">&lt;{message.from.email}&gt;</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            To: {message.to.map(t => t.email).join(', ')}
            {message.cc && ` · Cc: ${message.cc.map(c => c.email).join(', ')}`}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{dateFormatted}</div>
        </div>
      </div>

      <div
        className="prose prose-sm max-w-none text-foreground mt-4 [&_a]:text-brand-500 [&_a]:hover:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold"
        dangerouslySetInnerHTML={{ __html: message.body }}
      />

      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {message.attachments.map(att => (
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
  )
}

export function EmailDetail({ email, onDelete, onToggleStar }: EmailDetailProps) {
  const [replying,   setReplying]   = useState(false)
  const [thread,     setThread]     = useState<EmailMessage[]>([email])
  const [threadLoad, setThreadLoad] = useState(false)

  const loadThread = useCallback(() => {
    if (!email.threadId) { setThread([email]); return }
    setThreadLoad(true)
    emailThreadService.getThread(email.threadId)
      .then(msgs => setThread(msgs.length > 0 ? msgs : [email]))
      .catch(() => setThread([email]))
      .finally(() => setThreadLoad(false))
  }, [email])

  useEffect(() => {
    setReplying(false)
    loadThread()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.id])

  const latest = thread[thread.length - 1] ?? email
  const replySubject = latest.subject.startsWith('Re:') ? latest.subject : `Re: ${latest.subject}`

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

      {/* Thread content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <h2 className="text-xl font-bold text-foreground">{email.subject}</h2>
        {threadLoad && thread.length <= 1 && (
          <p className="text-xs text-muted-foreground">Loading conversation…</p>
        )}
        {thread.map(message => <MessageCard key={message.id} message={message} />)}
      </div>

      {/* Reply area — inline composer once active, matching Gmail's own thread reply UX */}
      {replying ? (
        <InlineReplyBox
          toEmail={latest.from.email}
          toName={latest.from.name}
          subject={replySubject}
          threadId={email.threadId}
          onSent={() => { setReplying(false); loadThread() }}
          onCancel={() => setReplying(false)}
        />
      ) : (
        <div className="shrink-0 border-t border-border px-6 py-4">
          <button type="button" onClick={() => setReplying(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/20 hover:bg-accent text-sm text-muted-foreground text-left transition-colors">
            <Reply className="h-4 w-4 shrink-0" />
            Reply to {latest.from.name}…
          </button>
        </div>
      )}
    </div>
  )
}
