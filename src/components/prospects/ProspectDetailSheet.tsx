import { useState, useEffect } from 'react'
import {
  X, Pencil, Trash2, Phone, Mail, ExternalLink, Globe,
  Building2, MapPin, User, Calendar, Tag, Briefcase,
  Clock, PhoneCall, Send, FileText, RefreshCw,
  ChevronRight, Save, XCircle, Copy, Check,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { StatusBadge } from './ProspectBadges'
import { ProspectForm, type ProspectFormValues } from './ProspectForm'
import type { Prospect } from '@/constants/mockData'
import { DISPOSITION_CODES, EMAIL_STATUSES, PROVIDERS } from '@/constants/mockData'
import { CampaignActivityFeed } from './CampaignActivityFeed'
import { getProspectCampaignEvents, type ProspectCampaignEvent } from '@/services/campaignService'
import { notesService, type NoteRow } from '@/services/notes.service'
import { usersService } from '@/services/users.service'
import { prospectsService } from '@/services/prospects.service'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { CRMUserRow, ProspectActivityRow, ProspectActivityType } from '@/types/database'

const ACTIVITY_ICONS: Record<ProspectActivityType, React.ElementType> = {
  call: PhoneCall,
  email: Mail,
  meeting: Calendar,
  task: Tag,
  note: FileText,
  status: RefreshCw,
}

// ── Helper sub-components ─────────────────────────────────────
function InfoRow({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value?: string | number; href?: string }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="mt-0.5 h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-sm text-brand-500 hover:text-brand-600 hover:underline truncate block mt-0.5 transition-colors">
            {String(value)}
          </a>
        ) : (
          <p className="text-sm text-foreground mt-0.5 break-all">{String(value)}</p>
        )}
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

// ── Plain-text summary for copy-to-clipboard ────────────────────
function buildProspectSummary(prospect: Prospect): string {
  const lines: string[] = []
  const push = (label: string, value?: string | number | null) => {
    if (!value && value !== 0) return
    lines.push(`${label}: ${value}`)
  }

  push('Name', prospect.fullname)
  push('Title', prospect.jobtitle)
  push('Company', prospect.company)
  lines.push('')
  push('Email', prospect.email)
  push('Alt Phone', prospect.altphonenumber !== '0' ? prospect.altphonenumber : undefined)
  push('Company Phone', prospect.companyphonenumber !== '0' ? prospect.companyphonenumber : undefined)
  push('Personal LinkedIn', prospect.personallinkedin)
  push('Company LinkedIn', prospect.companylinkedin)
  push('Website', prospect.website)
  lines.push('')
  push('Industry', prospect.industry)
  push('Employee Size', prospect.employeesize ? prospect.employeesize.toLocaleString() : undefined)
  push('Annual Revenue', prospect.annualrevenue ? `$${prospect.annualrevenue.toLocaleString()}` : undefined)
  push('Street', prospect.street)
  push('City / State', [prospect.city, prospect.state, prospect.postalcode].filter(Boolean).join(', ') || undefined)
  push('Country', prospect.country)

  return lines.join('\n').trim()
}

// ── Delete Confirmation ───────────────────────────────────────
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
            <p className="font-semibold text-foreground">Delete Prospect</p>
            <p className="text-xs text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to permanently delete <span className="font-semibold text-foreground">{name}</span>? All associated data will be removed.
        </p>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 h-9 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
type Tab = 'overview' | 'activity' | 'notes' | 'emails' | 'calls'

interface ProspectDetailSheetProps {
  prospect: Prospect
  onClose: () => void
  onUpdate: (values: ProspectFormValues) => Promise<void>
  onDelete: () => Promise<void>
  onEmail: () => void
}

export function ProspectDetailSheet({ prospect, onClose, onUpdate, onDelete, onEmail }: ProspectDetailSheetProps) {
  const { user: currentUser } = useCurrentUser()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [users, setUsers] = useState<CRMUserRow[]>([])
  const [campaignEvents, setCampaignEvents] = useState<ProspectCampaignEvent[]>([])
  const [activities, setActivities] = useState<ProspectActivityRow[]>([])
  const [callTitle, setCallTitle] = useState('')
  const [callDescription, setCallDescription] = useState('')
  const [savingCall, setSavingCall] = useState(false)

  useEffect(() => {
    let cancelled = false
    getProspectCampaignEvents(Number(prospect.id))
      .then(events => { if (!cancelled) setCampaignEvents(events) })
      .catch(() => { if (!cancelled) setCampaignEvents([]) })
    return () => { cancelled = true }
  }, [prospect.id])

  useEffect(() => {
    let cancelled = false
    notesService.getNotesForProspect(Number(prospect.id))
      .then(rows => { if (!cancelled) setNotes(rows) })
      .catch(() => { if (!cancelled) setNotes([]) })
    usersService.getUsers()
      .then(rows => { if (!cancelled) setUsers(rows) })
      .catch(() => { if (!cancelled) setUsers([]) })
    prospectsService.getActivities(Number(prospect.id))
      .then(rows => { if (!cancelled) setActivities(rows) })
      .catch(() => { if (!cancelled) setActivities([]) })
    return () => { cancelled = true }
  }, [prospect.id])

  async function logCall() {
    const title = callTitle.trim()
    if (!title || !currentUser) return
    setSavingCall(true)
    try {
      const created = await prospectsService.addActivity({
        prospect_id: Number(prospect.id),
        type:        'call',
        title,
        description: callDescription.trim() || null,
        created_by:  currentUser.id,
      })
      setActivities(prev => [created, ...prev])
      setCallTitle('')
      setCallDescription('')
      toast.success('Call logged')
    } catch {
      toast.error('Failed to log call')
    } finally {
      setSavingCall(false)
    }
  }

  const dispositionLabel = DISPOSITION_CODES.find(d => d.code === prospect.dispositioncode)?.name ?? prospect.dispositioncode
  const emailStatusLabel = EMAIL_STATUSES.find(e => e.code === prospect.emailcode)?.name ?? prospect.emailcode
  const providerLabel    = PROVIDERS.find(p => p.code === prospect.providercode)?.name ?? prospect.providercode
  const createdByUser    = users.find(u => u.id === prospect.createdby)

  async function handleSave(data: ProspectFormValues) {
    setIsSaving(true)
    try {
      await onUpdate(data)
      setEditing(false)
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildProspectSummary(prospect))
      setCopied(true)
      toast.success('Prospect details copied')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Failed to copy prospect details')
    }
  }

  async function handleDelete() {
    try {
      await onDelete()
      toast.success(`${prospect.fullname} deleted`)
    } catch {
      setConfirmDelete(false)
      toast.error('Failed to delete prospect')
    }
  }

  async function addNote() {
    const text = noteInput.trim()
    if (!text || !currentUser) return
    setSavingNote(true)
    try {
      const created = await notesService.createNote({
        title:       text.length > 60 ? `${text.slice(0, 60)}…` : text,
        description: text,
        prospect_id: Number(prospect.id),
        created_by:  currentUser.id,
      })
      setNotes(prev => [created, ...prev])
      setNoteInput('')
      toast.success('Note added')
    } catch {
      toast.error('Failed to add note')
    } finally {
      setSavingNote(false)
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'activity',  label: 'Activity'  },
    { id: 'notes',     label: `Notes (${notes.length})` },
    { id: 'emails',    label: 'Emails'    },
    { id: 'calls',     label: 'Calls'     },
  ]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed top-0 right-0 h-full z-50 w-full max-w-xl bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-border bg-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex items-start gap-4 min-w-0 sm:flex-1">
              {/* Avatar */}
              <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-lg font-bold text-brand-700 dark:text-brand-300 shrink-0">
                {prospect.firstname[0]?.toUpperCase()}{prospect.lastname[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground">{prospect.fullname}</h2>
                  <StatusBadge status={prospect.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {prospect.jobtitle}{prospect.jobtitle && prospect.company ? ' · ' : ''}{prospect.company}
                </p>
                {prospect.country && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {[prospect.city, prospect.country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0 justify-end sm:justify-start">
              {!editing && (
                <>
                  <button type="button" onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" onClick={handleCopy}
                    className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors" title="Copy details">
                    {copied
                      ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                      : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  <a href={`tel:${prospect.companyphonenumber}`}
                    className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors" title="Call">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                  <button type="button" onClick={onEmail}
                    className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors" title="Email">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(true)}
                    className="h-8 w-8 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </button>
                </>
              )}
              {editing && (
                <>
                  <button type="button" onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-muted-foreground transition-colors">
                    <XCircle className="h-3.5 w-3.5" /> Cancel
                  </button>
                </>
              )}
              <button type="button" onClick={onClose}
                className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors ml-1">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          {!editing && (
            <div className="flex gap-0.5 mt-4 -mb-px">
              {TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                    activeTab === t.id
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Edit mode */}
          {editing && (
            <ProspectForm
              defaultValues={{
                firstname:          prospect.firstname,
                lastname:           prospect.lastname,
                jobtitle:           prospect.jobtitle,
                company:            prospect.company,
                email:              prospect.email,
                emailcode:          prospect.emailcode,
                dispositioncode:    prospect.dispositioncode,
                providercode:       prospect.providercode,
                status:             prospect.status,
                website:            prospect.website,
                personallinkedin:   prospect.personallinkedin,
                companylinkedin:    prospect.companylinkedin,
                altphonenumber:     prospect.altphonenumber,
                companyphonenumber: prospect.companyphonenumber,
                address:            prospect.address,
                street:             prospect.street ?? '',
                city:               prospect.city,
                state:              prospect.state,
                postalcode:         prospect.postalcode ?? '',
                country:            prospect.country,
                industry:           prospect.industry,
                employeesize:       prospect.employeesize,
                annualrevenue:      prospect.annualrevenue,
                seniority:          prospect.seniority,
                department:         prospect.department,
                comments:           prospect.comments,
              }}
              onSubmit={handleSave}
              onCancel={() => setEditing(false)}
              submitLabel="Save Changes"
              isLoading={isSaving}
            />
          )}

          {/* ── Overview Tab ── */}
          {!editing && activeTab === 'overview' && (
            <>
              {/* Contact info */}
              <SectionCard title="Contact Information">
                <InfoRow icon={Mail}     label="Email"     value={prospect.email}     href={`mailto:${prospect.email}`} />
                <InfoRow icon={Phone}    label="Alt Phone" value={prospect.altphonenumber !== '0' ? prospect.altphonenumber : undefined} />
                <InfoRow icon={Phone}    label="Company Phone" value={prospect.companyphonenumber !== '0' ? prospect.companyphonenumber : undefined} />
                <InfoRow icon={ExternalLink} label="Personal LinkedIn" value={prospect.personallinkedin} href={prospect.personallinkedin} />
                <InfoRow icon={ExternalLink} label="Company LinkedIn" value={prospect.companylinkedin} href={prospect.companylinkedin} />
                <InfoRow icon={Globe}    label="Website"   value={prospect.website}   href={prospect.website} />
              </SectionCard>

              {/* Company info */}
              <SectionCard title="Company Information">
                <InfoRow icon={Building2} label="Company"       value={prospect.company} />
                <InfoRow icon={Briefcase} label="Industry"      value={prospect.industry} />
                <InfoRow icon={User}      label="Employee Size"  value={prospect.employeesize ? prospect.employeesize.toLocaleString() : undefined} />
                <InfoRow icon={Tag}       label="Annual Revenue" value={prospect.annualrevenue ? `$${prospect.annualrevenue.toLocaleString()}` : undefined} />
                <InfoRow icon={MapPin}    label="Street"         value={prospect.street} />
                <InfoRow icon={MapPin}    label="City / State"   value={[prospect.city, prospect.state, prospect.postalcode].filter(Boolean).join(', ')} />
                <InfoRow icon={MapPin}    label="Country"        value={prospect.country} />
                <InfoRow icon={MapPin}    label="Full Address"   value={prospect.address} />
              </SectionCard>

              {/* CRM info */}
              <SectionCard title="CRM Details">
                <InfoRow icon={Tag}      label="Disposition"  value={dispositionLabel} />
                <InfoRow icon={Tag}      label="Email Status" value={emailStatusLabel} />
                <InfoRow icon={Tag}      label="Provider"     value={providerLabel} />
                <InfoRow icon={User}     label="Seniority"    value={prospect.seniority} />
                <InfoRow icon={Briefcase}label="Department"   value={prospect.department} />
                <InfoRow icon={User}     label="Created By"   value={createdByUser ? `${createdByUser.first_name ?? ''} ${createdByUser.last_name ?? ''}`.trim() : prospect.createdby} />
                <InfoRow icon={Calendar} label="Created On"   value={format(new Date(prospect.createdon), 'PPP')} />
              </SectionCard>

              {/* Map placeholder */}
              {(prospect.city || prospect.country) && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="h-28 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/40 flex items-center justify-center">
                    <div className="text-center space-y-1">
                      <MapPin className="h-8 w-8 text-brand-400 mx-auto" />
                      <p className="text-sm font-medium text-brand-600 dark:text-brand-300">
                        {[prospect.city, prospect.country].filter(Boolean).join(', ')}
                      </p>
                      <p className="text-xs text-brand-400">Map view available after backend integration</p>
                    </div>
                  </div>
                </div>
              )}

              {prospect.comments && (
                <SectionCard title="Comments">
                  <p className="text-sm text-foreground py-3">{prospect.comments}</p>
                </SectionCard>
              )}

              {/* Campaign activity feed */}
              <SectionCard title="Campaign Activity">
                <div className="py-3">
                  <CampaignActivityFeed events={campaignEvents} />
                </div>
              </SectionCard>
            </>
          )}

          {/* ── Activity Tab ── */}
          {!editing && activeTab === 'activity' && (
            <div className="space-y-3">
              {activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-foreground">No activity yet</p>
                  <p className="text-sm text-muted-foreground">Notes, calls, and other activity for this prospect will appear here.</p>
                </div>
              )}
              {activities.map(a => {
                const Icon = ACTIVITY_ICONS[a.type]
                const author = users.find(u => u.id === a.created_by)
                return (
                  <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                      <p className="text-xs text-muted-foreground">
                        {author ? `${author.first_name ?? ''} ${author.last_name ?? ''}`.trim() : 'Unknown user'}
                        <span className="text-muted-foreground/40 mx-1.5">·</span>
                        {format(new Date(a.created_at), 'MMM d, yyyy · h:mm a')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Notes Tab ── */}
          {!editing && activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add note */}
              <div className="space-y-2">
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Add a note about this prospect…"
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors"
                />
                <div className="flex justify-end">
                  <button type="button" onClick={addNote} disabled={!noteInput.trim() || savingNote}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Save className="h-3.5 w-3.5" /> {savingNote ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>

              {/* Notes list */}
              <div className="space-y-3">
                {notes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No notes yet.</p>
                )}
                {notes.map(n => {
                  const author = users.find(u => u.id === n.created_by)
                  return (
                    <div key={n.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <p className="text-sm text-foreground">{n.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-300">
                          {author?.first_name?.[0]}{author?.last_name?.[0]}
                        </div>
                        {author ? `${author.first_name} ${author.last_name}` : 'Unknown user'}
                        <span className="text-muted-foreground/40">·</span>
                        {format(new Date(n.created_at), 'MMM d, yyyy · h:mm a')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Emails Tab ── */}
          {!editing && activeTab === 'emails' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <Send className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">Email History</p>
              <p className="text-sm text-muted-foreground">Email thread view will be available after Phase 9 (Emails page).</p>
              <button type="button" onClick={onEmail}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Mail className="h-4 w-4" /> Send Email
              </button>
            </div>
          )}

          {/* ── Calls Tab ── */}
          {!editing && activeTab === 'calls' && (() => {
            const calls = activities.filter(a => a.type === 'call')
            return (
              <div className="space-y-4">
                <a href={`tel:${prospect.companyphonenumber}`}
                  className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors w-fit">
                  <Phone className="h-4 w-4" /> Call Now
                </a>

                {/* Log a call */}
                <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Log a Call</p>
                  <input
                    value={callTitle}
                    onChange={e => setCallTitle(e.target.value)}
                    placeholder="e.g. Follow-up call, left voicemail…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  />
                  <textarea
                    value={callDescription}
                    onChange={e => setCallDescription(e.target.value)}
                    placeholder="Notes about the call (optional)…"
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors"
                  />
                  <div className="flex justify-end">
                    <button type="button" onClick={logCall} disabled={!callTitle.trim() || savingCall}
                      className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      <PhoneCall className="h-3.5 w-3.5" /> {savingCall ? 'Saving…' : 'Log Call'}
                    </button>
                  </div>
                </div>

                {/* Call log */}
                <div className="space-y-3">
                  {calls.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No calls logged yet.</p>
                  )}
                  {calls.map(c => {
                    const author = users.find(u => u.id === c.created_by)
                    return (
                      <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                        <p className="text-sm font-medium text-foreground">{c.title}</p>
                        {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-300">
                            {author?.first_name?.[0]}{author?.last_name?.[0]}
                          </div>
                          {author ? `${author.first_name} ${author.last_name}` : 'Unknown user'}
                          <span className="text-muted-foreground/40">·</span>
                          {format(new Date(c.created_at), 'MMM d, yyyy · h:mm a')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>

        {/* ── Footer breadcrumb ── */}
        <div className="px-6 py-3 border-t border-border bg-card flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Prospects</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground truncate">{prospect.fullname}</span>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <DeleteConfirm
          name={prospect.fullname}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
