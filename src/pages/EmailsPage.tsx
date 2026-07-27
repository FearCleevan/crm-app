import { useState } from 'react'
import { PenSquare, FileText, BarChart2, Inbox as InboxIcon, Send as SendIcon, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ComposeModal } from '@/components/emails/ComposeModal'
import { CampaignListView } from '@/components/emails/CampaignListView'
import { CampaignDetailView } from '@/components/emails/CampaignDetailView'
import { TemplateManager } from '@/components/emails/TemplateManager'
import { CreateCampaignWizard } from '@/components/emails/CreateCampaignWizard'
import { EmailList } from '@/components/emails/EmailList'
import { EmailDetail } from '@/components/emails/EmailDetail'
import { MOCK_EMAILS, type EmailFolder, type EmailMessage } from '@/constants/mockEmails'
import { useSentEmails } from '@/hooks/useSentEmails'
import type { CampaignFormData } from '@/components/emails/CreateCampaignWizard'
import type { TemplateFormData } from '@/components/emails/TemplateModal'
import { useCampaigns } from '@/hooks/useCampaigns'
import { addRecipients } from '@/services/campaignService'
import { useTemplates } from '@/hooks/useTemplates'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Campaign } from '@/types/campaigns'
import { cn } from '@/lib/utils'

// NOTE: 'inbox' | 'sent' | 'drafts' are wired to MOCK_EMAILS for now (Phase 1
// of EMAIL_INBOX_SENT_DRAFTS_FRONTEND_IMPLEMENTATION.md — nav + layout only).
// Real data source swap happens in later phases per that plan; Inbox
// specifically is blocked on the backend decision in
// EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md Phase 0.
type View = 'templates' | 'campaigns' | EmailFolder

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'inbox',     label: 'Inbox',     icon: InboxIcon },
  { id: 'sent',      label: 'Sent',      icon: SendIcon  },
  { id: 'drafts',    label: 'Drafts',    icon: Edit3     },
  { id: 'campaigns', label: 'Campaigns', icon: BarChart2 },
  { id: 'templates', label: 'Templates', icon: FileText  },
]

const MAIL_FOLDERS: EmailFolder[] = ['inbox', 'sent', 'drafts']

export function EmailsPage() {
  const { user } = useCurrentUser()
  const userId = user?.id ?? null

  const {
    campaigns,
    create: createCampaign,
    update: updateCampaign,
    remove: removeCampaign,
    launch: launchCampaign,
    pause: pauseCampaign,
    getRecipients,
  } = useCampaigns(userId)

  const {
    templates,
    create: createTemplate,
    update: updateTemplate,
    remove: removeTemplate,
    duplicate: duplicateTemplate,
  } = useTemplates(userId)

  const [view,              setView]              = useState<View>('campaigns')
  const [viewingCampaignId, setViewingCampaignId] = useState<string | null>(null)
  const [wizardOpen,        setWizardOpen]        = useState(false)
  const [editingCampaign,   setEditingCampaign]   = useState<Campaign | null>(null)
  const [composeOpen,       setComposeOpen]       = useState(false)

  // Phase 1 (nav + layout) state — Inbox/Drafts still mock, see note above NAV.
  // Sent is real data (Phase 2) via useSentEmails below.
  const [mailMessages,    setMailMessages]    = useState<EmailMessage[]>(MOCK_EMAILS)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [replyDraft,      setReplyDraft]      = useState<{ to: string; subject: string; body: string } | null>(null)

  const { emails: sentEmails, loading: sentLoading, error: sentError } = useSentEmails()

  function handleToggleStar(id: string) {
    setMailMessages(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e))
  }

  function handleDeleteEmail(id: string) {
    setMailMessages(prev => prev.filter(e => e.id !== id))
    setSelectedEmailId(current => current === id ? null : current)
    toast.success('Email deleted')
  }

  function handleReplyToEmail(email: EmailMessage) {
    setReplyDraft({
      to:      email.from.email,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body:    `<p></p><p>—</p>${email.body}`,
    })
    setComposeOpen(true)
  }

  async function handleTogglePause(id: string) {
    const c = campaigns.find(x => x.id === id)
    if (!c) return
    try {
      if (c.status === 'active') {
        await pauseCampaign(id)
        toast.success('Campaign paused')
      } else {
        await launchCampaign(id)
        toast.success('Campaign resumed')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update campaign')
    }
  }

  async function handleDeleteCampaign(id: string) {
    try {
      await removeCampaign(id)
      toast.success('Campaign deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete campaign')
    }
  }

  async function handleSaveCampaign(data: CampaignFormData) {
    if (!user) return
    try {
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, {
          name:           data.name,
          description:    data.description ?? null,
          template_id:    data.template_id ?? null,
          daily_limit:    data.daily_limit,
          send_from_hour: data.send_from_hour,
          send_to_hour:   data.send_to_hour,
          send_days:      data.send_days,
          warmup_enabled: data.warmup_enabled,
          status:         data.status,
        })
        toast.success('Campaign updated')
      } else {
        const created = await createCampaign({
          user_id:        user.id,
          name:           data.name,
          description:    data.description,
          template_id:    data.template_id,
          daily_limit:    data.daily_limit,
          send_from_hour: data.send_from_hour,
          send_to_hour:   data.send_to_hour,
          send_days:      data.send_days,
          warmup_enabled: data.warmup_enabled,
        })
        if (data.prospectIds.length > 0) {
          await addRecipients(created.id, data.prospectIds)
          await updateCampaign(created.id, { total_recipients: data.prospectIds.length })
        }
        toast.success(data.status === 'active' ? 'Campaign launched!' : 'Campaign saved as draft')
      }
      setWizardOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save campaign')
    }
  }

  async function handleAddTemplate(data: TemplateFormData) {
    if (!user) return
    try {
      await createTemplate({
        name:       data.name,
        category:   data.category,
        subject:    data.subject,
        body:       data.body,
        variables:  data.variables,
        created_by: user.id,
      })
      toast.success('Template created')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create template')
    }
  }

  async function handleUpdateTemplate(id: string, data: TemplateFormData) {
    try {
      await updateTemplate(id, {
        name:      data.name,
        category:  data.category,
        subject:   data.subject,
        body:      data.body,
        variables: data.variables,
      })
      toast.success('Template updated')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update template')
    }
  }

  async function handleDeleteTemplate(id: string) {
    try {
      await removeTemplate(id)
      toast.success('Template deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete template')
    }
  }

  async function handleDuplicateTemplate(t: { id: string }) {
    if (!user) return
    try {
      await duplicateTemplate(t.id, user.id)
      toast.success('Template duplicated')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to duplicate template')
    }
  }

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <PenSquare className="h-3.5 w-3.5" /> Compose
          </button>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Mobile nav */}
        <div className="md:hidden shrink-0 border-b border-border bg-card">
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
            >
              <PenSquare className="h-3.5 w-3.5" /> Compose
            </button>
            <div className="flex overflow-x-auto gap-0.5 no-scrollbar">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={cn(
                    'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
                    view === id
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside className="hidden md:flex w-44 shrink-0 border-r border-border bg-card flex-col py-4 gap-1 px-2">
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-2 w-full h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors mb-2"
            >
              <PenSquare className="h-4 w-4" /> Compose
            </button>

            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors',
                  view === id
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', view === id ? 'text-brand-500' : '')} />
                <span className="flex-1">{label}</span>
              </button>
            ))}
          </aside>

          {/* Mail folders: Inbox / Sent / Drafts */}
          {MAIL_FOLDERS.includes(view as EmailFolder) && (() => {
            const isSent       = view === 'sent'
            const folderEmails = isSent ? sentEmails : mailMessages.filter(e => e.folder === view)
            const selected     = folderEmails.find(e => e.id === selectedEmailId) ?? null

            if (isSent && sentLoading) {
              return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading sent emails…</div>
            }
            if (isSent && sentError) {
              return <div className="flex-1 flex items-center justify-center text-sm text-destructive">Failed to load sent emails: {sentError}</div>
            }

            return (
              <div className="flex flex-1 min-w-0 min-h-0">
                <div className="w-80 shrink-0 border-r border-border overflow-y-auto">
                  <EmailList
                    emails={folderEmails}
                    selectedId={selectedEmailId}
                    onSelect={e => setSelectedEmailId(e.id)}
                    onToggleStar={isSent ? () => toast.info('Starring sent emails isn\'t supported yet') : handleToggleStar}
                  />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  {selected ? (
                    <EmailDetail
                      email={selected}
                      onReply={handleReplyToEmail}
                      onDelete={isSent ? () => toast.info('Deleting sent emails isn\'t supported yet') : handleDeleteEmail}
                      onToggleStar={isSent ? () => toast.info('Starring sent emails isn\'t supported yet') : handleToggleStar}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Select an email to view
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Templates view */}
          {view === 'templates' && (
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
              <TemplateManager
                templates={templates}
                onAdd={handleAddTemplate}
                onUpdate={handleUpdateTemplate}
                onDelete={handleDeleteTemplate}
                onDuplicate={handleDuplicateTemplate}
              />
            </div>
          )}

          {/* Campaigns list */}
          {view === 'campaigns' && !viewingCampaignId && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <CampaignListView
                campaigns={campaigns}
                onNew={() => { setEditingCampaign(null); setWizardOpen(true) }}
                onEdit={c => { setEditingCampaign(c); setWizardOpen(true) }}
                onView={c => setViewingCampaignId(c.id)}
                onDelete={handleDeleteCampaign}
                onTogglePause={handleTogglePause}
              />
            </div>
          )}

          {/* Campaign detail */}
          {view === 'campaigns' && viewingCampaignId && (() => {
            const c = campaigns.find(x => x.id === viewingCampaignId)
            return c ? (
              <div className="flex-1 min-w-0 overflow-hidden">
                <CampaignDetailView campaign={c} onBack={() => setViewingCampaignId(null)} getRecipients={getRecipients} />
              </div>
            ) : null
          })()}
        </div>
      </PageWrapper>

      <CreateCampaignWizard
        open={wizardOpen}
        templates={templates}
        initial={editingCampaign}
        onClose={() => setWizardOpen(false)}
        onSave={handleSaveCampaign}
      />

      <ComposeModal
        open={composeOpen}
        templates={templates}
        initialTo={replyDraft?.to}
        initialSubject={replyDraft?.subject}
        initialBody={replyDraft?.body}
        onClose={() => { setComposeOpen(false); setReplyDraft(null) }}
        onSend={() => {}}
        onSaveDraft={() => {}}
      />
    </>
  )
}
