import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { toast } from 'sonner'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { emailService } from '@/services/email.service'
import { buildSignature } from '@/lib/emailSignature'
import { EmailEditor } from './EmailEditor'

interface InlineReplyBoxProps {
  toEmail: string
  toName: string
  subject: string
  onSent: () => void
  onCancel: () => void
}

// Docked reply composer shown inline at the bottom of an open thread, matching how Gmail's
// own inline reply works — separate from ComposeModal's floating popup, which stays reserved
// for starting a brand new message.
export function InlineReplyBox({ toEmail, toName, subject, onSent, onCancel }: InlineReplyBoxProps) {
  const { user } = useAuth()
  const [body,    setBody]    = useState('<p></p>')
  const [sigOn,   setSigOn]   = useState(true)
  const [sending, setSending] = useState(false)

  const signature = buildSignature(user)

  async function handleSend() {
    setSending(true)
    try {
      await emailService.send({
        to:      toEmail,
        subject,
        html:    sigOn ? body + signature : body,
      })
      toast.success('Reply sent')
      onSent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
        <p className="text-xs text-muted-foreground">
          Replying to <span className="font-medium text-foreground">{toName}</span> <span className="text-muted-foreground/70">&lt;{toEmail}&gt;</span>
        </p>
        <button type="button" onClick={onCancel} aria-label="Discard reply"
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <EmailEditor
        content={body}
        onChange={setBody}
        placeholder="Write your reply…"
        minHeight="120px"
        className="border-0 rounded-none"
      />

      {sigOn && (
        <div
          className="px-4 py-3 border-t border-dashed border-border/60 bg-muted/20 max-h-24 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(signature) }}
        />
      )}

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border">
        <button type="button" onClick={handleSend} disabled={sending}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          <Send className="h-3.5 w-3.5" /> {sending ? 'Sending…' : 'Send'}
        </button>
        <button type="button" onClick={() => setSigOn(v => !v)}
          className={cn(
            'h-7 px-2.5 rounded text-xs font-medium transition-colors border',
            sigOn
              ? 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/20'
              : 'text-muted-foreground border-border hover:bg-accent',
          )}>
          {sigOn ? '✓ Signature' : '+ Signature'}
        </button>
        <div className="flex-1" />
        <button type="button" onClick={onCancel}
          className="h-7 px-3 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
