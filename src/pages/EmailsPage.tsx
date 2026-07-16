import { useState } from 'react'
import { PenSquare, FileText, BarChart2 } from 'lucide-react'
import { toast } from 'sonner'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ComposeModal } from '@/components/emails/ComposeModal'
import { CampaignListView } from '@/components/emails/CampaignListView'
import { CampaignDetailView } from '@/components/emails/CampaignDetailView'
import { TemplateManager } from '@/components/emails/TemplateManager'
import { CreateCampaignWizard } from '@/components/emails/CreateCampaignWizard'
import type { CampaignFormData } from '@/components/emails/CreateCampaignWizard'
import type { TemplateFormData } from '@/components/emails/TemplateModal'
import { useCampaigns } from '@/hooks/useCampaigns'
import { addRecipients } from '@/services/campaignService'
import { useTemplates } from '@/hooks/useTemplates'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Campaign } from '@/types/campaigns'
import { cn } from '@/lib/utils'

type View = 'templates' | 'campaigns'

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'campaigns', label: 'Campaigns', icon: BarChart2 },
  { id: 'templates', label: 'Templates', icon: FileText  },
]

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
        onClose={() => setComposeOpen(false)}
        onSend={() => {}}
        onSaveDraft={() => {}}
      />
    </>
  )
}
