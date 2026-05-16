import { useState, useCallback, useMemo } from 'react'
import { PenSquare, Inbox, Send, FileText, BarChart2, Search, X, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { EmailList } from '@/components/emails/EmailList'
import { EmailDetail } from '@/components/emails/EmailDetail'
import { ComposeModal } from '@/components/emails/ComposeModal'
import { TemplatesPanel } from '@/components/emails/TemplatesPanel'
import { TemplateFormModal } from '@/components/emails/TemplateFormModal'
import { CampaignStats } from '@/components/emails/CampaignStats'
import { MOCK_EMAILS, MOCK_TEMPLATES, type EmailMessage, type EmailTemplate, type EmailFolder } from '@/constants/mockEmails'
import { cn } from '@/lib/utils'

type View = EmailFolder | 'templates' | 'campaigns'

const NAV: { id: View; label: string; icon: React.ElementType; folder?: EmailFolder }[] = [
  { id: 'inbox',     label: 'Inbox',     icon: Inbox,     folder: 'inbox'   },
  { id: 'sent',      label: 'Sent',      icon: Send,      folder: 'sent'    },
  { id: 'drafts',    label: 'Drafts',    icon: FileText,  folder: 'drafts'  },
  { id: 'templates', label: 'Templates', icon: FileText                     },
  { id: 'campaigns', label: 'Campaigns', icon: BarChart2                    },
]

function useEmailsState() {
  const [emails, setEmails] = useState<EmailMessage[]>(MOCK_EMAILS)

  const markRead = useCallback((id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, read: true } : e))
  }, [])

  const toggleStar = useCallback((id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e))
  }, [])

  const deleteEmail = useCallback((id: string) => {
    setEmails(prev => prev.filter(e => e.id !== id))
    toast.success('Email deleted')
  }, [])

  const addEmail = useCallback((msg: EmailMessage) => {
    setEmails(prev => [msg, ...prev])
  }, [])

  return { emails, markRead, toggleStar, deleteEmail, addEmail }
}

function useTemplatesState() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(MOCK_TEMPLATES)

  const addTemplate = useCallback((data: Omit<EmailTemplate, 'id'>) => {
    const tpl: EmailTemplate = { ...data, id: `tpl-${Date.now()}` }
    setTemplates(prev => [...prev, tpl])
    toast.success(`Template "${tpl.name}" created`)
  }, [])

  const updateTemplate = useCallback((id: string, data: Omit<EmailTemplate, 'id'>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    toast.success('Template updated')
  }, [])

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  return { templates, addTemplate, updateTemplate, deleteTemplate }
}

export function EmailsPage() {
  const { emails, markRead, toggleStar, deleteEmail, addEmail } = useEmailsState()
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplatesState()

  const [view, setView] = useState<View>('inbox')
  const [selected, setSelected] = useState<EmailMessage | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; body: string } | undefined>()
  const [search, setSearch] = useState('')

  const [templateFormOpen, setTemplateFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  const folderEmails = useMemo(() => {
    const folder = view === 'inbox' || view === 'sent' || view === 'drafts' ? view : null
    if (!folder) return []
    let list = emails.filter(e => e.folder === folder)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.from.name.toLowerCase().includes(q) ||
        e.from.email.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q)
      )
    }
    return list
  }, [emails, view, search])

  const unreadCount = useMemo(() => emails.filter(e => e.folder === 'inbox' && !e.read).length, [emails])

  function handleSelect(email: EmailMessage) {
    setSelected(email)
    markRead(email.id)
  }

  function handleReply(email: EmailMessage) {
    setReplyTo({
      to: email.from.email,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n---\nOn ${new Date(email.date).toLocaleString()}, ${email.from.name} wrote:\n${email.body.replace(/<[^>]+>/g, '')}`,
    })
    setComposeOpen(true)
  }

  function handleDelete(id: string) {
    deleteEmail(id)
    if (selected?.id === id) setSelected(null)
  }

  function handleUseTemplate(tpl: EmailTemplate) {
    setReplyTo({ to: '', subject: tpl.subject, body: tpl.body })
    setComposeOpen(true)
    setView('inbox')
  }

  function handleOpenCreate() {
    setEditingTemplate(null)
    setTemplateFormOpen(true)
  }

  function handleOpenEdit(tpl: EmailTemplate) {
    setEditingTemplate(tpl)
    setTemplateFormOpen(true)
  }

  function handleTemplateSave(data: Omit<EmailTemplate, 'id'>) {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, data)
    } else {
      addTemplate(data)
    }
    setTemplateFormOpen(false)
    setEditingTemplate(null)
  }

  const isMailView = view === 'inbox' || view === 'sent' || view === 'drafts'

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setReplyTo(undefined); setComposeOpen(true) }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <PenSquare className="h-3.5 w-3.5" /> Compose
          </button>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Mobile nav bar — Compose + scrollable tabs */}
        <div className="md:hidden shrink-0 border-b border-border bg-card">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <button
              type="button"
              onClick={() => { setReplyTo(undefined); setComposeOpen(true) }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
            >
              <PenSquare className="h-3.5 w-3.5" /> Compose
            </button>
            <div className="flex overflow-x-auto gap-0.5 no-scrollbar">
              {NAV.map(({ id, label, icon: Icon }) => {
                const count = id === 'inbox' ? unreadCount : id === 'drafts' ? emails.filter(e => e.folder === 'drafts').length : 0
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setView(id); setSelected(null) }}
                    className={cn(
                      'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
                      view === id
                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                    {count > 0 && (
                      <span className="h-4 min-w-4 rounded-full bg-brand-500 text-white text-[9px] font-bold px-1 flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar — hidden on mobile, shown on tablet+ */}
          <aside className="hidden md:flex w-44 shrink-0 border-r border-border bg-card flex-col py-4 gap-1 px-2">
            <button
              type="button"
              onClick={() => { setReplyTo(undefined); setComposeOpen(true) }}
              className="flex items-center gap-2 w-full h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors mb-2"
            >
              <PenSquare className="h-4 w-4" /> Compose
            </button>

            {NAV.map(({ id, label, icon: Icon }) => {
              const count = id === 'inbox' ? unreadCount : id === 'drafts' ? emails.filter(e => e.folder === 'drafts').length : 0
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setView(id); setSelected(null) }}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors',
                    view === id
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', view === id ? 'text-brand-500' : '')} />
                  <span className="flex-1">{label}</span>
                  {count > 0 && (
                    <span className="h-5 min-w-5 rounded-full bg-brand-500 text-white text-[10px] font-bold px-1 flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </aside>

          {/* Mail views */}
          {isMailView && (
            <div className="flex flex-1 min-w-0 min-h-0">
              {/* ── Mobile: stacked (list OR detail, not both) ── */}
              <div className="md:hidden flex flex-col flex-1 min-w-0 min-h-0">
                {selected ? (
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* Back button */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0">
                      <button type="button" onClick={() => setSelected(null)}
                        className="flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-accent text-sm font-medium text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <EmailDetail email={selected} onReply={handleReply} onDelete={handleDelete} onToggleStar={toggleStar} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="px-4 py-3 border-b border-border shrink-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails…"
                          className="w-full h-8 pl-8 pr-7 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                        {search && (
                          <button type="button" aria-label="Clear search" onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <EmailList emails={folderEmails} selectedId={null} onSelect={handleSelect} onToggleStar={toggleStar} />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Tablet+ (≥768px): side-by-side split ── */}
              <div className="hidden md:flex flex-1 min-w-0 min-h-0">
                {/* Email list pane */}
                <div className={cn(
                  'flex flex-col border-r border-border shrink-0 transition-all',
                  selected ? 'w-72' : 'flex-1',
                )}>
                  <div className="px-4 py-3 border-b border-border shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails…"
                        className="w-full h-8 pl-8 pr-7 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                      {search && (
                        <button type="button" aria-label="Clear search" onClick={() => setSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <EmailList emails={folderEmails} selectedId={selected?.id ?? null} onSelect={handleSelect} onToggleStar={toggleStar} />
                  </div>
                </div>

                {/* Email detail pane */}
                {selected ? (
                  <div className="flex-1 min-w-0">
                    <EmailDetail email={selected} onReply={handleReply} onDelete={handleDelete} onToggleStar={toggleStar} />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                      <Inbox className="h-10 w-10 mx-auto opacity-20" />
                      <p className="text-sm">Select an email to read</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Templates view */}
          {view === 'templates' && (
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
              <TemplatesPanel
                templates={templates}
                onUse={handleUseTemplate}
                onCreate={handleOpenCreate}
                onEdit={handleOpenEdit}
                onDelete={deleteTemplate}
              />
            </div>
          )}

          {/* Campaigns view */}
          {view === 'campaigns' && (
            <div className="flex-1 min-w-0 overflow-y-auto">
              <CampaignStats />
            </div>
          )}
        </div>
      </PageWrapper>

      <ComposeModal
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setReplyTo(undefined) }}
        onSend={msg => { addEmail(msg); setView('sent') }}
        onSaveDraft={msg => { addEmail(msg); setView('drafts') }}
        initialTo={replyTo?.to}
        initialSubject={replyTo?.subject}
        initialBody={replyTo?.body}
      />

      <TemplateFormModal
        open={templateFormOpen}
        initial={editingTemplate}
        onClose={() => { setTemplateFormOpen(false); setEditingTemplate(null) }}
        onSave={handleTemplateSave}
      />
    </>
  )
}
