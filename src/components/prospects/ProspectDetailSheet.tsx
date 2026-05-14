import { useState } from 'react'
import {
  X, Pencil, Trash2, Phone, Mail, ExternalLink, Globe,
  Building2, MapPin, User, Calendar, Tag, Briefcase,
  MessageSquare, Clock, CheckCircle2, PhoneCall, Send,
  ChevronRight, Save, XCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { StatusBadge } from './ProspectBadges'
import { ProspectForm, type ProspectFormValues } from './ProspectForm'
import type { Prospect } from '@/constants/mockData'
import { MOCK_USERS, DISPOSITION_CODES, EMAIL_STATUSES, PROVIDERS } from '@/constants/mockData'

// ── Mock activity data ────────────────────────────────────────
const ACTIVITY_ICONS = {
  call:  { Icon: PhoneCall,     color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  email: { Icon: Mail,          color: 'text-violet-500',  bg: 'bg-violet-100 dark:bg-violet-900/30' },
  note:  { Icon: MessageSquare, color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  status:{ Icon: Tag,           color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  task:  { Icon: CheckCircle2,  color: 'text-rose-500',    bg: 'bg-rose-100 dark:bg-rose-900/30' },
}

const MOCK_ACTIVITIES = [
  { id: 'a1', type: 'call'  as const, desc: 'Outbound call — discussed product fit. Prospect showed interest in Enterprise plan.', user: 'usr-003', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'a2', type: 'email' as const, desc: 'Sent follow-up email with pricing deck attached.', user: 'usr-002', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'a3', type: 'note'  as const, desc: 'Prospect requested a custom demo for their team of 50.', user: 'usr-001', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'a4', type: 'status'as const, desc: 'Status changed from New → Contacted.', user: 'usr-002', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'a5', type: 'task'  as const, desc: 'Task completed: Send LinkedIn connection request.', user: 'usr-003', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
]

interface MockNote {
  id: string
  text: string
  authorId: string
  createdAt: string
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
  onUpdate: (updated: Prospect) => void
  onDelete: (id: string) => void
}

export function ProspectDetailSheet({ prospect, onClose, onUpdate, onDelete }: ProspectDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [notes, setNotes] = useState<MockNote[]>([
    { id: 'n1', text: 'Strong interest in Enterprise plan. Will follow up after internal review.', authorId: 'usr-001', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'n2', text: 'Left voicemail — no response yet. Try again Friday.', authorId: 'usr-003', createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
  ])
  const [noteInput, setNoteInput] = useState('')

  const dispositionLabel = DISPOSITION_CODES.find(d => d.code === prospect.dispositioncode)?.name ?? prospect.dispositioncode
  const emailStatusLabel = EMAIL_STATUSES.find(e => e.code === prospect.emailcode)?.name ?? prospect.emailcode
  const providerLabel    = PROVIDERS.find(p => p.code === prospect.providercode)?.name ?? prospect.providercode
  const createdByUser    = MOCK_USERS.find(u => u.id === prospect.createdby)

  async function handleSave(data: ProspectFormValues) {
    setIsSaving(true)
    await new Promise(r => setTimeout(r, 400))
    const updated: Prospect = {
      ...prospect,
      firstname: data.firstname,
      lastname:  data.lastname,
      fullname:  `${data.firstname} ${data.lastname}`,
      jobtitle:  data.jobtitle ?? prospect.jobtitle,
      company:   data.company,
      email:     data.email,
      emailcode: (data.emailcode as Prospect['emailcode']) ?? prospect.emailcode,
      dispositioncode: data.dispositioncode ?? prospect.dispositioncode,
      providercode:    data.providercode ?? prospect.providercode,
      status:    data.status,
      website:   data.website ?? prospect.website,
      personallinkedin: data.personallinkedin ?? prospect.personallinkedin,
      altphonenumber: data.altphonenumber ?? prospect.altphonenumber,
      companyphonenumber: data.companyphonenumber ?? prospect.companyphonenumber,
      city:      data.city ?? prospect.city,
      state:     data.state ?? prospect.state,
      country:   data.country ?? prospect.country,
      industry:  data.industry ?? prospect.industry,
      employeesize: data.employeesize ?? prospect.employeesize,
      annualrevenue: data.annualrevenue ?? prospect.annualrevenue,
      seniority: data.seniority ?? prospect.seniority,
      department: data.department ?? prospect.department,
      comments:  data.comments ?? prospect.comments,
    }
    onUpdate(updated)
    toast.success('Prospect updated')
    setEditing(false)
    setIsSaving(false)
  }

  function handleDelete() {
    onDelete(prospect.id)
    toast.success(`${prospect.fullname} deleted`)
    onClose()
  }

  function addNote() {
    if (!noteInput.trim()) return
    setNotes(prev => [{
      id: `n-${Date.now()}`,
      text: noteInput.trim(),
      authorId: 'usr-001',
      createdAt: new Date().toISOString(),
    }, ...prev])
    setNoteInput('')
    toast.success('Note added')
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
          <div className="flex items-start gap-4">
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

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {!editing && (
                <>
                  <button type="button" onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <a href={`tel:${prospect.companyphonenumber}`}
                    className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors" title="Call">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                  <a href={`mailto:${prospect.email}`}
                    className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors" title="Email">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
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
                firstname: prospect.firstname,
                lastname:  prospect.lastname,
                jobtitle:  prospect.jobtitle,
                company:   prospect.company,
                email:     prospect.email,
                emailcode: prospect.emailcode,
                dispositioncode: prospect.dispositioncode,
                providercode:    prospect.providercode,
                status:    prospect.status,
                website:   prospect.website,
                personallinkedin: prospect.personallinkedin,
                altphonenumber: prospect.altphonenumber,
                companyphonenumber: prospect.companyphonenumber,
                city:      prospect.city,
                state:     prospect.state,
                country:   prospect.country,
                industry:  prospect.industry,
                employeesize: prospect.employeesize,
                annualrevenue: prospect.annualrevenue,
                seniority: prospect.seniority,
                department: prospect.department,
                comments:  prospect.comments,
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
                <InfoRow icon={ExternalLink} label="LinkedIn"  value={prospect.personallinkedin} href={prospect.personallinkedin} />
                <InfoRow icon={Globe}    label="Website"   value={prospect.website}   href={prospect.website} />
              </SectionCard>

              {/* Company info */}
              <SectionCard title="Company Information">
                <InfoRow icon={Building2} label="Company"       value={prospect.company} />
                <InfoRow icon={Briefcase} label="Industry"      value={prospect.industry} />
                <InfoRow icon={User}      label="Employee Size"  value={prospect.employeesize ? prospect.employeesize.toLocaleString() : undefined} />
                <InfoRow icon={Tag}       label="Annual Revenue" value={prospect.annualrevenue ? `$${prospect.annualrevenue.toLocaleString()}` : undefined} />
                <InfoRow icon={MapPin}    label="Address"        value={[prospect.address, prospect.city, prospect.state, prospect.country].filter(Boolean).join(', ')} />
              </SectionCard>

              {/* CRM info */}
              <SectionCard title="CRM Details">
                <InfoRow icon={Tag}      label="Disposition"  value={dispositionLabel} />
                <InfoRow icon={Tag}      label="Email Status" value={emailStatusLabel} />
                <InfoRow icon={Tag}      label="Provider"     value={providerLabel} />
                <InfoRow icon={User}     label="Seniority"    value={prospect.seniority} />
                <InfoRow icon={Briefcase}label="Department"   value={prospect.department} />
                <InfoRow icon={User}     label="Created By"   value={createdByUser ? `${createdByUser.first_name} ${createdByUser.last_name}` : prospect.createdby} />
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
            </>
          )}

          {/* ── Activity Tab ── */}
          {!editing && activeTab === 'activity' && (
            <div className="space-y-0">
              {MOCK_ACTIVITIES.map((act, i) => {
                const meta = ACTIVITY_ICONS[act.type]
                const user = MOCK_USERS.find(u => u.id === act.user)
                return (
                  <div key={act.id} className="flex gap-4 pb-5">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', meta.bg)}>
                        <meta.Icon className={cn('h-4 w-4', meta.color)} />
                      </div>
                      {i < MOCK_ACTIVITIES.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-2 mb-0 min-h-[20px]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-0">
                      <p className="text-sm text-foreground leading-snug">{act.desc}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {user ? `${user.first_name} ${user.last_name}` : act.user}
                        </span>
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
                  <button type="button" onClick={addNote} disabled={!noteInput.trim()}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Save className="h-3.5 w-3.5" /> Save Note
                  </button>
                </div>
              </div>

              {/* Notes list */}
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

          {/* ── Emails Tab ── */}
          {!editing && activeTab === 'emails' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <Send className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">Email History</p>
              <p className="text-sm text-muted-foreground">Email thread view will be available after Phase 9 (Emails page).</p>
              <a href={`mailto:${prospect.email}`}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Mail className="h-4 w-4" /> Send Email
              </a>
            </div>
          )}

          {/* ── Calls Tab ── */}
          {!editing && activeTab === 'calls' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <PhoneCall className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">Call Log</p>
              <p className="text-sm text-muted-foreground">Logged calls will appear here after backend integration.</p>
              <a href={`tel:${prospect.companyphonenumber}`}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Phone className="h-4 w-4" /> Call Now
              </a>
            </div>
          )}
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
