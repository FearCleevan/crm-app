import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { X, Minus, Maximize2, Paperclip, Send, Clock, ChevronDown, PenSquare, Eye, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'
import { useProspectSearch, type ProspectSuggestion } from '@/hooks/useProspectSearch'
import { emailService } from '@/services/email.service'
import { useAuth } from '@/context/AuthContext'
import { EmailEditor } from './EmailEditor'
import type { RichTemplateDB } from '@/types/campaigns'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Variable resolver ─────────────────────────────────────────
function resolveVars(text: string, prospect: { firstname?: string | null; fullname?: string | null; company?: string | null } | null): string {
  if (!text) return text
  return text
    .replace(/{{first_name}}/g,   prospect?.firstname   ?? '')
    .replace(/{{full_name}}/g,    prospect?.fullname    ?? '')
    .replace(/{{company}}/g,      prospect?.company     ?? 'your company')
    .replace(/{{my_name}}/g,      'Peter Lazan')
    .replace(/{{my_portfolio}}/g, 'lazandev.vercel.app')
}

// ── Email chip input ──────────────────────────────────────────
function EmailChipInput({
  label, chips, onChipsChange, inputCls, suggestions, onSuggestionPick, onInput,
}: {
  label: string
  chips: string[]
  onChipsChange: (chips: string[]) => void
  inputCls: string
  suggestions?: ProspectSuggestion[]
  onSuggestionPick?: (email: string) => void
  onInput?: (val: string) => void
}) {
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commit(val: string) {
    const email = val.trim().replace(/,+$/, '')
    if (EMAIL_RE.test(email) && !chips.includes(email)) {
      onChipsChange([...chips, email])
    }
    setRaw('')
    onInput?.('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      e.preventDefault()
      if (raw.trim()) commit(raw)
    } else if (e.key === 'Backspace' && !raw && chips.length > 0) {
      onChipsChange(chips.slice(0, -1))
    }
  }

  function handleBlur() {
    if (raw.trim()) commit(raw)
  }

  return (
    <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
      {chips.map(email => (
        <span key={email} className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-medium shrink-0 max-w-[200px]">
          <span className="truncate">{email}</span>
          <button type="button" title={`Remove ${email}`} onClick={() => onChipsChange(chips.filter(c => c !== email))}
            className="shrink-0 text-primary/60 hover:text-primary transition-colors leading-none">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <div className="relative flex-1 min-w-[120px]">
        <input
          ref={inputRef}
          value={raw}
          onChange={e => { setRaw(e.target.value); onInput?.(e.target.value) }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={chips.length === 0 ? `${label === 'To' ? 'recipient@example.com' : `${label.toLowerCase()}@example.com`}` : ''}
          className={cn(inputCls, 'w-full')}
        />
        {suggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-10 bg-card border border-border rounded-xl shadow-xl overflow-hidden mt-1 min-w-[260px]">
            {suggestions.map(p => (
              <button key={p.id} type="button"
                onMouseDown={e => { e.preventDefault(); if (p.email) onSuggestionPick?.(p.email) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors">
                <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                  {(p.firstname?.[0] ?? '?')}{(p.lastname?.[0] ?? '')}
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
    </div>
  )
}

// ── Email template presets ────────────────────────────────────
const PRESETS: { label: string; html: string }[] = [
  { label: 'Blank', html: '<p></p>' },
  {
    label: 'Simple Outreach',
    html: `<p>Hi {{first_name}},</p><p>I hope this message finds you well. I'm reaching out because I believe we can add real value to your team.</p><p>Would you have 15 minutes this week for a quick call?</p><p>Looking forward to hearing from you.</p><p>Best regards,</p>`,
  },
  {
    label: 'Follow-up',
    html: `<p>Hi {{first_name}},</p><p>I wanted to follow up on my previous message. I understand you're busy, but I didn't want this to slip through the cracks.</p><p>If now isn't a good time, please let me know when would work best.</p><p>Best regards,</p>`,
  },
  {
    label: 'Newsletter',
    html: `<table width="600" style="border-collapse:collapse;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><tr><td style="background:#4f46e5;padding:32px;text-align:center"><h1 style="color:white;margin:0;font-size:24px">Monthly Newsletter</h1><p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Your update for this month</p></td></tr><tr><td style="padding:32px;background:#ffffff"><h2 style="font-size:18px;color:#111827;margin:0 0 12px">This Month's Highlights</h2><p style="color:#4b5563;line-height:1.6;margin:0 0 16px">Share your key updates, news, or announcements here. Keep it concise and valuable for your readers.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/><h2 style="font-size:18px;color:#111827;margin:0 0 12px">Featured Article</h2><p style="color:#4b5563;line-height:1.6;margin:0 0 16px">Add your article summary or key insight here.</p></td></tr><tr><td style="background:#f9fafb;padding:24px;text-align:center"><p style="color:#9ca3af;font-size:12px;margin:0">You're receiving this because you opted in to our newsletter.</p></td></tr></table>`,
  },
  {
    label: 'Promotional',
    html: `<table width="600" style="border-collapse:collapse;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><tr><td style="background:#4f46e5;padding:48px 32px;text-align:center"><h1 style="color:white;margin:0 0 12px;font-size:28px">Special Offer</h1><p style="color:rgba(255,255,255,0.85);margin:0;font-size:16px;line-height:1.5">Don't miss out on this limited-time opportunity</p></td></tr><tr><td style="padding:40px 32px;background:#ffffff;text-align:center"><p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 32px">Add your promotional message here. Highlight the key benefit your recipient will get.</p><a href="#" style="display:inline-block;background:#4f46e5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Get Started Now</a></td></tr><tr><td style="padding:24px 32px;background:#ffffff"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px"/><p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">Add any terms, conditions, or additional info here.</p></td></tr><tr><td style="background:#f9fafb;padding:24px;text-align:center"><p style="color:#9ca3af;font-size:12px;margin:0">© 2026 Brisk CRM. All rights reserved.</p></td></tr></table>`,
  },
]

// ── Signature builder ─────────────────────────────────────────
function buildSignature(user: { first_name?: string; last_name?: string; role?: string; email?: string; phone_no?: string | null; profile_url?: string | null } | null): string {
  if (!user) return ''
  const name     = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`
  const avatar   = user.profile_url
    ? `<img src="${user.profile_url}" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block" />`
    : `<td width="48" height="48" style="background:#4f46e5;border-radius:50%;text-align:center;vertical-align:middle;font-size:20px;font-weight:700;color:white;width:48px;height:48px">${initials}</td>`

  return `<br/><table cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><tr><td style="padding-right:14px;vertical-align:middle">${user.profile_url ? `<table><tr>${avatar}</tr></table>` : `<table><tr>${avatar}</tr></table>`}</td><td style="vertical-align:middle"><div style="font-weight:700;font-size:14px;color:#111827;line-height:1.3">${name}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${user.role ?? ''}</div><div style="font-size:12px;color:#6b7280;margin-top:2px">${user.email ?? ''}</div>${user.phone_no ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${user.phone_no}</div>` : ''}</td></tr></table>`
}


interface ComposeModalProps {
  open: boolean
  onClose: () => void
  onSend: () => void
  onSaveDraft: () => void
  templates?: RichTemplateDB[]
  initialTo?: string
  initialSubject?: string
  initialBody?: string
}

// ── Highlight unresolved vars in preview ─────────────────────
function highlightUnresolved(html: string): string {
  return html.replace(/{{[^}]+}}/g, match =>
    `<span style="background:#f97316;color:white;padding:0 4px;border-radius:3px;font-size:0.85em">${match}</span>`
  )
}

export function ComposeModal({
  open, onClose, onSend, onSaveDraft, templates = [],
  initialTo = '', initialSubject = '', initialBody = '',
}: ComposeModalProps) {
  const { user } = useAuth()
  const [minimized,        setMinimized]        = useState(false)
  const [toChips,          setToChips]          = useState<string[]>(initialTo ? [initialTo] : [])
  const [ccChips,          setCcChips]          = useState<string[]>([])
  const [bccChips,         setBccChips]         = useState<string[]>([])
  const [showCcBcc,        setShowCcBcc]        = useState(false)
  const [subject,          setSubject]          = useState(initialSubject)
  const [body,             setBody]             = useState(initialBody || '<p></p>')
  const [sending,          setSending]          = useState(false)
  const [toSearchQuery,    setToSearchQuery]    = useState('')
  const [showPresets,      setShowPresets]      = useState(false)
  const [presetKey,        setPresetKey]        = useState(0)
  const [sigEnabled,       setSigEnabled]       = useState(true)

  // ── New state: template picker ────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<RichTemplateDB | null>(null)

  // ── New state: prospect linker ────────────────────────────
  const [linkedProspect,   setLinkedProspect]   = useState<{ fullname: string; email: string; firstname?: string; company?: string } | null>(null)
  const [prospectSearch,   setProspectSearch]   = useState('')
  const [prospectQuery,    setProspectQuery]    = useState('')
  const { results: suggestions,     clear: clearToSuggestions }   = useProspectSearch(toSearchQuery)
  const { results: prospectResults, clear: clearProspectResults }  = useProspectSearch(prospectQuery)

  // ── New state: variable preview ───────────────────────────
  const [previewMode,      setPreviewMode]      = useState(false)

  // ── New state: schedule send ──────────────────────────────
  const [scheduledAt,      setScheduledAt]      = useState('')
  const [showSchedule,     setShowSchedule]     = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const handleToRawInput = useCallback((val: string) => {
    setToSearchQuery(val)
  }, [])

  const handleSuggestionPick = useCallback((email: string) => {
    if (email && !toChips.includes(email)) setToChips(prev => [...prev, email])
    setToSearchQuery('')
    clearToSuggestions()
  }, [toChips, clearToSuggestions])

  if (!open) return null

  const signature = buildSignature(user)

  function applyPreset(html: string) {
    setBody(html)
    setPresetKey(k => k + 1)
    setShowPresets(false)
  }

  // ── Template picker handler ───────────────────────────────
  function handleTemplateSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const tplId = e.target.value
    if (!tplId) {
      setSelectedTemplate(null)
      setPreviewMode(false)
      return
    }
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return
    setSelectedTemplate(tpl)
    setSubject(resolveVars(tpl.subject, linkedProspect))
    const resolved = resolveVars(tpl.body, linkedProspect)
    // Convert plain text body to HTML paragraphs
    const htmlBody = resolved.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('')
    setBody(htmlBody)
    setPresetKey(k => k + 1)
    setPreviewMode(false)
    toast.success('Template applied')
  }

  // ── Prospect search handler ───────────────────────────────
  function handleProspectSearch(val: string) {
    setProspectSearch(val)
    setProspectQuery(val)
  }

  function handleProspectPick(prospect: ProspectSuggestion) {
    const linked = { fullname: prospect.fullname ?? '', email: prospect.email ?? '', firstname: prospect.firstname ?? undefined, company: prospect.company ?? undefined }
    setLinkedProspect(linked)
    setProspectSearch('')
    setProspectQuery('')
    clearProspectResults()
    // Auto-push prospect email into To chips
    if (prospect.email && !toChips.includes(prospect.email)) {
      setToChips(prev => [...prev, prospect.email as string])
    }
    // Re-resolve template vars if a template is selected
    if (selectedTemplate) {
      setSubject(resolveVars(selectedTemplate.subject, linked))
      const resolved = resolveVars(selectedTemplate.body, linked)
      const htmlBody = resolved.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('')
      setBody(htmlBody)
      setPresetKey(k => k + 1)
    }
  }

  function handleUnlinkProspect() {
    setLinkedProspect(null)
    setProspectSearch('')
    setProspectQuery('')
    clearProspectResults()
  }

  function getFinalHtml() {
    return sigEnabled ? body + signature : body
  }

  async function handleSend() {
    if (toChips.length === 0) { toast.error('Please add a recipient'); return }

    // Schedule send
    if (scheduledAt) {
      if (new Date(scheduledAt) <= new Date()) {
        toast.error('Scheduled time must be in the future')
        return
      }
      if (!user?.id) {
        toast.error('You must be signed in to schedule an email')
        return
      }
      setSending(true)
      try {
        await emailService.scheduleSend({
          to:      toChips,
          ...(ccChips.length > 0 ? { cc: ccChips } : {}),
          ...(bccChips.length > 0 ? { bcc: bccChips } : {}),
          subject: subject || '(no subject)',
          html:    getFinalHtml(),
          scheduledAt: new Date(scheduledAt).toISOString(),
          userId: user.id,
        })
        const formatted = new Date(scheduledAt).toLocaleString()
        toast.success(`Email scheduled for ${formatted}`)
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to schedule email')
      } finally {
        setSending(false)
      }
      return
    }

    setSending(true)
    try {
      await emailService.send({
        to:      toChips,
        ...(ccChips.length > 0 ? { cc: ccChips } : {}),
        ...(bccChips.length > 0 ? { bcc: bccChips } : {}),
        subject: subject || '(no subject)',
        html:    getFinalHtml(),
      })
      onSend()
      toast.success('Email sent')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  function handleSaveDraft() {
    onSaveDraft()
    toast.success('Draft saved')
    onClose()
  }

  const inputRow = 'flex items-center gap-2 px-4 py-2 border-b border-border/60'
  const inputCls = 'bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none'

  // Build preview HTML with unresolved vars highlighted
  const previewHtml = highlightUnresolved(resolveVars(body, linkedProspect))

  return (
    <div className={cn(
      'fixed z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200',
      minimized
        ? 'bottom-14 lg:bottom-0 right-6 w-72 h-12'
        : 'bottom-16 lg:bottom-4 right-4 w-[640px] max-w-[calc(100vw-2rem)] h-[680px] max-h-[calc(100vh-5rem)]',
    )}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-foreground/5 border-b border-border shrink-0 cursor-default">
        <PenSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1 truncate">{subject || 'New Message'}</span>
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
          {/* ── Template Picker ── */}
          <div className={cn(inputRow, 'gap-3')}>
            <span className="text-xs font-semibold text-muted-foreground shrink-0 w-16">Template</span>
            <select
              value={selectedTemplate?.id ?? ''}
              onChange={handleTemplateSelect}
              className="flex-1 bg-transparent text-sm text-foreground focus:outline-none cursor-pointer"
            >
              <option value="">Use a template…</option>
              {templates.map(tpl => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
          </div>

          {/* ── Prospect Linker ── */}
          <div className={cn(inputRow, 'relative gap-3')}>
            <span className="text-xs font-semibold text-muted-foreground shrink-0 w-16">Prospect</span>
            {linkedProspect ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-medium text-foreground">{linkedProspect.fullname}</span>
                <span className="text-xs text-muted-foreground">→ {linkedProspect.email}</span>
                <button
                  type="button"
                  onClick={handleUnlinkProspect}
                  className="ml-auto h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Unlink prospect"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex-1 relative">
                <input
                  value={prospectSearch}
                  onChange={e => handleProspectSearch(e.target.value)}
                  placeholder="Search by name, email or company…"
                  className={cn(inputCls, 'w-full')}
                />
                {prospectResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden mt-1 min-w-[280px]">
                    {prospectResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleProspectPick(p) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors"
                      >
                        <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                          {(p.firstname?.[0] ?? '?')}{(p.lastname?.[0] ?? '')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.fullname}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.email} · {p.company}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* To */}
          <div className={cn(inputRow, 'relative flex-wrap min-h-[36px]')}>
            <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">To</span>
            <EmailChipInput
              label="To"
              chips={toChips}
              onChipsChange={chips => { setToChips(chips); clearToSuggestions() }}
              inputCls={inputCls}
              suggestions={suggestions}
              onSuggestionPick={handleSuggestionPick}
              onInput={handleToRawInput}
            />
            <button type="button" onClick={() => setShowCcBcc(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 shrink-0">
              Cc/Bcc <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {showCcBcc && (
            <>
              <div className={cn(inputRow, 'flex-wrap min-h-[36px]')}>
                <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">Cc</span>
                <EmailChipInput label="Cc" chips={ccChips} onChipsChange={setCcChips} inputCls={inputCls} />
              </div>
              <div className={cn(inputRow, 'flex-wrap min-h-[36px]')}>
                <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">Bcc</span>
                <EmailChipInput label="Bcc" chips={bccChips} onChipsChange={setBccChips} inputCls={inputCls} />
              </div>
            </>
          )}

          {/* Subject */}
          <div className={inputRow}>
            <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">Sub</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
              className={cn(inputCls, 'font-medium')} />

            {/* Template preset picker */}
            <div className="relative shrink-0">
              <button type="button" onClick={() => setShowPresets(v => !v)}
                className="flex items-center gap-1 h-6 px-2 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border">
                Preset <ChevronDown className="h-3 w-3" />
              </button>
              {showPresets && (
                <div className="absolute top-full right-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                  {PRESETS.map(p => (
                    <button key={p.label} type="button" onClick={() => applyPreset(p.html)}
                      className="w-full px-3 py-2 text-xs text-left text-foreground hover:bg-accent transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rich text editor / Preview */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {previewMode && selectedTemplate ? (
              <div
                className="px-4 py-3 text-sm text-foreground leading-relaxed min-h-[200px]"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
              />
            ) : (
              <EmailEditor
                key={presetKey}
                content={body}
                onChange={setBody}
                placeholder="Write your message…"
                minHeight="200px"
                className="border-0 rounded-none"
              />
            )}

            {/* Signature preview */}
            {sigEnabled && (
              <div
                className="px-4 py-3 border-t border-dashed border-border/60 bg-muted/20"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(signature) }}
              />
            )}
          </div>

          {/* Schedule datetime picker */}
          {showSchedule && (
            <div className={cn(inputRow, 'bg-muted/30')}>
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className={cn(inputCls, 'flex-1')}
              />
              {scheduledAt && (
                <button
                  type="button"
                  onClick={() => { setScheduledAt(''); setShowSchedule(false) }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Footer toolbar */}
          <div className="flex items-center gap-1 px-3 py-3 border-t border-border shrink-0 bg-card">
            <button type="button" onClick={handleSend} disabled={sending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {scheduledAt ? <Clock className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? 'Sending…' : scheduledAt ? 'Schedule Send' : 'Send'}
            </button>

            {/* Schedule button */}
            <button
              type="button"
              onClick={() => setShowSchedule(v => !v)}
              className={cn(
                'h-9 w-9 rounded-lg flex items-center justify-center transition-colors',
                showSchedule || scheduledAt
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title="Schedule send"
            >
              <Clock className="h-4 w-4" />
            </button>

            <button type="button" onClick={() => fileRef.current?.click()}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Attach file">
              <Paperclip className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" className="hidden" aria-label="Attach file" title="Attach file"
              onChange={() => toast.info('File attachments — available in a future update')} />

            {/* Variable preview toggle — only when template is selected */}
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => setPreviewMode(v => !v)}
                className={cn(
                  'h-7 px-2.5 rounded text-xs font-medium transition-colors border flex items-center gap-1',
                  previewMode
                    ? 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/20'
                    : 'text-muted-foreground border-border hover:bg-accent',
                )}
                title={previewMode ? 'Switch to editing' : 'Preview with variables resolved'}
              >
                {previewMode ? <Edit2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {previewMode ? 'Editing' : 'Preview'}
              </button>
            )}

            <div className="flex-1" />

            {/* Signature toggle */}
            <button type="button" onClick={() => setSigEnabled(v => !v)}
              className={cn(
                'h-7 px-2.5 rounded text-xs font-medium transition-colors border',
                sigEnabled
                  ? 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/20'
                  : 'text-muted-foreground border-border hover:bg-accent',
              )}>
              {sigEnabled ? '✓ Signature' : '+ Signature'}
            </button>

            <button type="button" onClick={handleSaveDraft}
              className="h-7 px-3 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              Save Draft
            </button>
          </div>
        </>
      )}
    </div>
  )
}
