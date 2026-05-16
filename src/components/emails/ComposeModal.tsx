import { useState, useRef } from 'react'
import { X, Minus, Maximize2, Paperclip, Send, Clock, FileText, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MOCK_PROSPECTS } from '@/constants/mockData'
import type { EmailMessage } from '@/constants/mockEmails'

interface ComposeModalProps {
  open: boolean
  onClose: () => void
  onSend: (msg: EmailMessage) => void
  onSaveDraft: (msg: EmailMessage) => void
  initialTo?: string
  initialSubject?: string
  initialBody?: string
}

function buildMessage(to: string, cc: string, subject: string, body: string, folder: 'sent' | 'drafts'): EmailMessage {
  const prospect = MOCK_PROSPECTS.find(p => p.email === to)
  return {
    id: `em-${Date.now()}`,
    folder,
    from: { name: 'Me', email: 'me@briskcrm.com' },
    to: [{ name: prospect?.fullname ?? to, email: to }],
    cc: cc ? [{ name: cc, email: cc }] : undefined,
    subject: subject || '(no subject)',
    preview: body.replace(/<[^>]+>/g, '').slice(0, 120),
    body,
    date: new Date().toISOString(),
    read: true, starred: false, hasAttachment: false,
  }
}

export function ComposeModal({ open, onClose, onSend, onSaveDraft, initialTo = '', initialSubject = '', initialBody = '' }: ComposeModalProps) {
  const [minimized, setMinimized] = useState(false)
  const [toInput, setToInput] = useState(initialTo)
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState<typeof MOCK_PROSPECTS>([])
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function handleToInput(val: string) {
    setToInput(val)
    if (val.length >= 2) {
      const q = val.toLowerCase()
      setSuggestions(MOCK_PROSPECTS.filter(p =>
        p.fullname.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
      ).slice(0, 5))
    } else {
      setSuggestions([])
    }
  }

  async function handleSend() {
    if (!toInput.trim()) { toast.error('Please add a recipient'); return }
    setSending(true)
    await new Promise(r => setTimeout(r, 600))
    onSend(buildMessage(toInput, cc, subject, body, 'sent'))
    toast.success('Email sent')
    setSending(false)
    onClose()
  }

  function handleSaveDraft() {
    onSaveDraft(buildMessage(toInput, cc, subject, body, 'drafts'))
    toast.success('Draft saved')
    onClose()
  }

  function handleSchedule() {
    toast.info('Scheduled send available after backend integration')
  }

  const inputRow = 'flex items-center gap-2 px-4 py-2 border-b border-border/60'
  const inputCls = 'flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none'

  return (
    <div className={cn(
      'fixed z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200',
      minimized
        ? 'bottom-14 lg:bottom-0 right-6 w-72 h-12'
        : 'bottom-16 lg:bottom-4 right-4 w-[560px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-2rem)]',
    )}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-foreground/5 border-b border-border shrink-0 cursor-default">
        <span className="text-sm font-semibold text-foreground flex-1 truncate">
          {subject || 'New Message'}
        </span>
        <button type="button" aria-label="Minimize" onClick={() => setMinimized(v => !v)}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Maximize"
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Close compose" onClick={onClose}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <>
          {/* To field with autocomplete */}
          <div className={cn(inputRow, 'relative')}>
            <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">To</span>
            <input
              value={toInput}
              onChange={e => handleToInput(e.target.value)}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              placeholder="recipient@example.com"
              className={inputCls}
            />
            <button type="button" onClick={() => setShowCcBcc(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 shrink-0">
              Cc/Bcc <ChevronDown className="h-3 w-3" />
            </button>
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-card border border-border rounded-xl shadow-xl overflow-hidden mt-1">
                {suggestions.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setToInput(p.email); setSuggestions([]) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors">
                    <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                      {p.firstname[0]}{p.lastname[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.fullname}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className={inputRow}>
                <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">Cc</span>
                <input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" className={inputCls} />
              </div>
              <div className={inputRow}>
                <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">Bcc</span>
                <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@example.com" className={inputCls} />
              </div>
            </>
          )}

          {/* Subject */}
          <div className={inputRow}>
            <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">Sub</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={cn(inputCls, 'font-medium')} />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message…"
            className="flex-1 px-4 py-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
          />

          {/* Footer toolbar */}
          <div className="flex items-center gap-1 px-3 py-3 border-t border-border shrink-0">
            <button type="button" onClick={handleSend} disabled={sending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Sending…' : 'Send'}
            </button>

            <button type="button" onClick={handleSchedule}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Schedule send">
              <Clock className="h-4 w-4" />
            </button>

            <button type="button" onClick={() => fileRef.current?.click()}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Attach file">
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              aria-label="Attach file"
              title="Attach file"
              onChange={() => toast.info('File attachment available after backend integration')}
            />

            <div className="flex-1" />

            <button type="button" onClick={handleSaveDraft}
              className="h-9 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Save Draft
            </button>
          </div>
        </>
      )}
    </div>
  )
}
