import { useState, useEffect } from 'react'
import { X, Pencil, Trash2, Mail, Phone, Calendar, TrendingUp, Clock, Tag, User, Briefcase, ChevronRight, XCircle, PhoneCall, MessageSquare, CheckCircle2, Send, Save, Video } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { dealsService } from '@/services/deals.service'
import type { DealActivityRow, CRMUserRow } from '@/types/database'
import type { Deal } from '@/constants/mockData'
import { STAGE_BADGE } from './StageBadge'
import { PIPELINE_STAGES } from './PipelineBoard'

type Tab = 'overview' | 'activity' | 'notes'

const ACTIVITY_ICONS: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  call:    { Icon: PhoneCall,     color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  email:   { Icon: Mail,          color: 'text-violet-500',  bg: 'bg-violet-100 dark:bg-violet-900/30' },
  note:    { Icon: MessageSquare, color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  status:  { Icon: Tag,           color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  task:    { Icon: CheckCircle2,  color: 'text-rose-500',    bg: 'bg-rose-100 dark:bg-rose-900/30' },
  meeting: { Icon: Video,         color: 'text-indigo-500',  bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="mt-0.5 h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm text-foreground mt-0.5">{String(value)}</p>
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/40">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</p>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Delete Deal</p>
            <p className="text-xs text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-semibold text-foreground">{name}</span>?
        </p>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
          <button type="button" onClick={onConfirm}
            className="flex-1 h-9 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

interface DealDetailSheetProps {
  deal: Deal
  dealId: string
  users: CRMUserRow[]
  currentUserId: string
  initialEditing?: boolean
  onClose: () => void
  onUpdate: (updates: Partial<Deal>) => void
  onDelete: (id: string) => void
}

export function DealDetailSheet({ deal, dealId, users, currentUserId, initialEditing = false, onClose, onUpdate, onDelete }: DealDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(initialEditing)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editStage, setEditStage] = useState<Deal['stage']>(deal.stage)
  const [editValue, setEditValue] = useState(String(deal.value))
  const [editProb, setEditProb] = useState(String(deal.probability))
  const [editClose, setEditClose] = useState(deal.expectedCloseDate)
  const [editAssigned, setEditAssigned] = useState(deal.assignedTo)
  const [editDesc, setEditDesc] = useState(deal.description)

  const [activities, setActivities] = useState<DealActivityRow[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    let alive = true
    setActivitiesLoading(true)
    dealsService.getActivities(dealId)
      .then(data => { if (alive) setActivities(data) })
      .catch(() => {})
      .finally(() => { if (alive) setActivitiesLoading(false) })
    return () => { alive = false }
  }, [dealId])

  const notes = activities.filter(a => a.type === 'note')

  const assignee = users.find(u => u.id === deal.assignedTo)
  const { label: stageLabel, cls: stageCls } = STAGE_BADGE[deal.stage]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'notes',    label: `Notes (${notes.length})` },
  ]

  function getUserName(userId: string | null) {
    if (!userId) return 'Unknown'
    const u = users.find(u => u.id === userId)
    return u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : userId
  }

  function handleSave() {
    onUpdate({
      stage:             editStage,
      value:             Number(editValue),
      probability:       Number(editProb),
      expectedCloseDate: editClose,
      assignedTo:        editAssigned,
      description:       editDesc,
    })
    setEditing(false)
  }

  function handleDelete() {
    onDelete(deal.id)
    onClose()
  }

  async function addNote() {
    if (!noteInput.trim()) return
    setSavingNote(true)
    try {
      const created = await dealsService.addActivity({
        deal_id:     dealId,
        type:        'note',
        title:       noteInput.trim(),
        description: null,
        created_by:  currentUserId || null,
      })
      setActivities(prev => [created, ...prev])
      setNoteInput('')
      toast.success('Note added')
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 w-full max-w-xl bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-card">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-lg font-bold text-brand-700 dark:text-brand-300 shrink-0">
              {deal.company[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground leading-snug">{deal.name}</h2>
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', stageCls)}>{stageLabel}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{deal.company}</p>
              <p className="text-xl font-bold text-foreground mt-1">${deal.value.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!editing && (
                <>
                  <button type="button" onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(true)}
                    className="h-8 w-8 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </button>
                </>
              )}
              {editing && (
                <button type="button" onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-muted-foreground transition-colors">
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Close"
                className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors ml-1">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {!editing && (
            <div className="flex gap-0.5 mt-4 -mb-px">
              {TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                  className={cn('px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                    activeTab === t.id ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Edit mode */}
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="edit-stage" className="text-xs font-semibold text-foreground">Stage</label>
                <select id="edit-stage" value={editStage} onChange={e => setEditStage(e.target.value as Deal['stage'])}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-value" className="text-xs font-semibold text-foreground">Value ($)</label>
                  <input id="edit-value" type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-prob" className="text-xs font-semibold text-foreground">Probability (%)</label>
                  <input id="edit-prob" type="number" min={0} max={100} value={editProb} onChange={e => setEditProb(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-close" className="text-xs font-semibold text-foreground">Expected Close Date</label>
                <input id="edit-close" type="date" value={editClose} onChange={e => setEditClose(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-assigned" className="text-xs font-semibold text-foreground">Assigned To</label>
                <select id="edit-assigned" value={editAssigned} onChange={e => setEditAssigned(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-desc" className="text-xs font-semibold text-foreground">Description</label>
                <textarea id="edit-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button type="button" onClick={() => setEditing(false)}
                  className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                <button type="button" onClick={handleSave}
                  className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Save Changes</button>
              </div>
            </div>
          )}

          {/* Overview tab */}
          {!editing && activeTab === 'overview' && (
            <>
              <SectionCard title="Deal Information">
                <InfoRow icon={Tag}        label="Stage"          value={deal.stage} />
                <InfoRow icon={TrendingUp} label="Probability"    value={`${deal.probability}%`} />
                <InfoRow icon={Calendar}   label="Expected Close" value={format(new Date(deal.expectedCloseDate), 'PPP')} />
                <InfoRow icon={Clock}      label="Days in Stage"  value={`${deal.daysInStage} days`} />
                <InfoRow icon={Calendar}   label="Created On"     value={format(new Date(deal.createdOn), 'PPP')} />
              </SectionCard>
              <SectionCard title="Contact">
                <InfoRow icon={User}      label="Prospect"    value={deal.prospectName} />
                <InfoRow icon={Briefcase} label="Company"     value={deal.company} />
                {assignee && <InfoRow icon={User} label="Assigned To" value={`${assignee.first_name ?? ''} ${assignee.last_name ?? ''}`.trim()} />}
              </SectionCard>
              {deal.description && (
                <SectionCard title="Description">
                  <p className="text-sm text-foreground py-3">{deal.description}</p>
                </SectionCard>
              )}
              <div className="flex gap-2">
                <button type="button"
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                  <Mail className="h-4 w-4" /> Send Email
                </button>
                <button type="button"
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                  <Phone className="h-4 w-4" /> Log Call
                </button>
              </div>
            </>
          )}

          {/* Activity tab */}
          {!editing && activeTab === 'activity' && (
            <div className="space-y-0">
              {activitiesLoading && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Loading activity…
                </div>
              )}
              {!activitiesLoading && activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <Tag className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                </div>
              )}
              {!activitiesLoading && activities.map((act, i) => {
                const meta = ACTIVITY_ICONS[act.type] ?? ACTIVITY_ICONS.note
                return (
                  <div key={act.id} className="flex gap-4 pb-5">
                    <div className="flex flex-col items-center">
                      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', meta.bg)}>
                        <meta.Icon className={cn('h-4 w-4', meta.color)} />
                      </div>
                      {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-2 min-h-[20px]" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-0">
                      <p className="text-sm text-foreground leading-snug">{act.title}</p>
                      {act.description && <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">{getUserName(act.created_by)}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(act.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Notes tab */}
          {!editing && activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                  placeholder="Add a note about this deal…" rows={3}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors" />
                <div className="flex justify-end">
                  <button type="button" onClick={addNote} disabled={!noteInput.trim() || savingNote}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Save className="h-3.5 w-3.5" /> {savingNote ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {notes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No notes yet. Add one above.</p>
                  </div>
                )}
                {notes.map(n => {
                  const initials = getUserName(n.created_by).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <div key={n.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <p className="text-sm text-foreground">{n.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-300">
                          {initials}
                        </div>
                        {getUserName(n.created_by)}
                        <span className="text-muted-foreground/40">·</span>
                        {format(new Date(n.created_at), 'MMM d, yyyy · h:mm a')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Emails placeholder */}
          {!editing && activeTab === ('emails' as Tab) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Send className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Email history will be available in a future update.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-card flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Deals</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground truncate">{deal.name}</span>
        </div>
      </div>

      {confirmDelete && (
        <DeleteConfirm name={deal.name} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
      )}
    </>
  )
}
