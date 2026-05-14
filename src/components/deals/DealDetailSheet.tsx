import { useState } from 'react'
import { X, Pencil, Trash2, Mail, Phone, Calendar, TrendingUp, Clock, Tag, User, Briefcase, ChevronRight, XCircle, PhoneCall, MessageSquare, CheckCircle2, Send, Save } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MOCK_USERS, type Deal } from '@/constants/mockData'
import { STAGE_BADGE } from './StageBadge'
import { PIPELINE_STAGES } from './PipelineBoard'

type Tab = 'overview' | 'activity' | 'notes'

const ACTIVITY_ICONS = {
  call:   { Icon: PhoneCall,     color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  email:  { Icon: Mail,          color: 'text-violet-500',  bg: 'bg-violet-100 dark:bg-violet-900/30' },
  note:   { Icon: MessageSquare, color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  status: { Icon: Tag,           color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  task:   { Icon: CheckCircle2,  color: 'text-rose-500',    bg: 'bg-rose-100 dark:bg-rose-900/30' },
}

const MOCK_ACTIVITIES = [
  { id: 'da1', type: 'call'   as const, desc: 'Discovery call — prospect confirmed budget and timeline.', user: 'usr-001', date: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'da2', type: 'email'  as const, desc: 'Sent proposal PDF with custom pricing breakdown.', user: 'usr-002', date: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'da3', type: 'note'   as const, desc: 'Competitor mentioned: SalesForce. Need to highlight differentiators.', user: 'usr-001', date: new Date(Date.now() - 8 * 86400000).toISOString() },
  { id: 'da4', type: 'status' as const, desc: 'Stage updated: New Lead → Qualified.', user: 'usr-003', date: new Date(Date.now() - 12 * 86400000).toISOString() },
]

interface MockNote { id: string; text: string; authorId: string; createdAt: string }

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
  onClose: () => void
  onUpdate: (deal: Deal) => void
  onDelete: (id: string) => void
}

export function DealDetailSheet({ deal, onClose, onUpdate, onDelete }: DealDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editStage, setEditStage] = useState<Deal['stage']>(deal.stage)
  const [editValue, setEditValue] = useState(String(deal.value))
  const [editProb, setEditProb] = useState(String(deal.probability))
  const [editClose, setEditClose] = useState(deal.expectedCloseDate)
  const [editAssigned, setEditAssigned] = useState(deal.assignedTo)
  const [editDesc, setEditDesc] = useState(deal.description)
  const [notes, setNotes] = useState<MockNote[]>([
    { id: 'dn1', text: 'Great conversation — clear buying intent expressed.', authorId: 'usr-001', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  ])
  const [noteInput, setNoteInput] = useState('')

  const assignee = MOCK_USERS.find(u => u.id === deal.assignedTo)
  const { label: stageLabel, cls: stageCls } = STAGE_BADGE[deal.stage]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'notes',    label: `Notes (${notes.length})` },
  ]

  function handleSave() {
    onUpdate({
      ...deal,
      stage:              editStage,
      value:              Number(editValue),
      probability:        Number(editProb),
      expectedCloseDate:  editClose,
      assignedTo:         editAssigned,
      description:        editDesc,
    })
    toast.success('Deal updated')
    setEditing(false)
  }

  function handleDelete() {
    onDelete(deal.id)
    toast.success(`${deal.name} deleted`)
    onClose()
  }

  function addNote() {
    if (!noteInput.trim()) return
    setNotes(prev => [{ id: `dn-${Date.now()}`, text: noteInput.trim(), authorId: 'usr-001', createdAt: new Date().toISOString() }, ...prev])
    setNoteInput('')
    toast.success('Note added')
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
                <label className="text-xs font-semibold text-foreground">Stage</label>
                <select value={editStage} onChange={e => setEditStage(e.target.value as Deal['stage'])}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Value ($)</label>
                  <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Probability (%)</label>
                  <input type="number" min={0} max={100} value={editProb} onChange={e => setEditProb(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Expected Close Date</label>
                <input type="date" value={editClose} onChange={e => setEditClose(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Assigned To</label>
                <select value={editAssigned} onChange={e => setEditAssigned(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
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
                <InfoRow icon={Tag}       label="Stage"            value={deal.stage} />
                <InfoRow icon={TrendingUp}label="Probability"      value={`${deal.probability}%`} />
                <InfoRow icon={Calendar}  label="Expected Close"   value={format(new Date(deal.expectedCloseDate), 'PPP')} />
                <InfoRow icon={Clock}     label="Days in Stage"    value={`${deal.daysInStage} days`} />
                <InfoRow icon={Calendar}  label="Created On"       value={format(new Date(deal.createdOn), 'PPP')} />
              </SectionCard>
              <SectionCard title="Contact">
                <InfoRow icon={User}      label="Prospect"         value={deal.prospectName} />
                <InfoRow icon={Briefcase} label="Company"          value={deal.company} />
                {assignee && <InfoRow icon={User} label="Assigned To" value={`${assignee.first_name} ${assignee.last_name}`} />}
              </SectionCard>
              {deal.description && (
                <SectionCard title="Description">
                  <p className="text-sm text-foreground py-3">{deal.description}</p>
                </SectionCard>
              )}
              {/* Quick actions */}
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
              {MOCK_ACTIVITIES.map((act, i) => {
                const meta = ACTIVITY_ICONS[act.type]
                const user = MOCK_USERS.find(u => u.id === act.user)
                return (
                  <div key={act.id} className="flex gap-4 pb-5">
                    <div className="flex flex-col items-center">
                      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', meta.bg)}>
                        <meta.Icon className={cn('h-4 w-4', meta.color)} />
                      </div>
                      {i < MOCK_ACTIVITIES.length - 1 && <div className="w-px flex-1 bg-border mt-2 min-h-[20px]" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-0">
                      <p className="text-sm text-foreground leading-snug">{act.desc}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">{user ? `${user.first_name} ${user.last_name}` : act.user}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(act.date), 'MMM d, yyyy')}
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
                  <button type="button" onClick={addNote} disabled={!noteInput.trim()}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Save className="h-3.5 w-3.5" /> Save Note
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {notes.map(n => {
                  const author = MOCK_USERS.find(u => u.id === n.authorId)
                  return (
                    <div key={n.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <p className="text-sm text-foreground">{n.text}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-300">
                          {author?.first_name[0]}{author?.last_name[0]}
                        </div>
                        {author ? `${author.first_name} ${author.last_name}` : n.authorId}
                        <span className="text-muted-foreground/40">·</span>
                        {format(new Date(n.createdAt), 'MMM d, yyyy · h:mm a')}
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
              <p className="text-sm text-muted-foreground">Email history will be available after Phase 9.</p>
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
