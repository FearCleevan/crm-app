import { useState, useEffect, useCallback } from 'react'
import {
  Search, Plus, StickyNote, Link2, Briefcase, User,
  MoreHorizontal, Pencil, Trash2, X, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { notesService, type NoteRow, type NoteFilter } from '@/services/notes.service'
import { supabase } from '@/lib/supabase'

// ── Helpers ────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)      return 'just now'
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').trim()
}

// ── Note Form Modal ────────────────────────────────────────────
interface NoteFormModalProps {
  open: boolean
  initial?: NoteRow | null
  onClose: () => void
  onSaved: () => void
  currentUserId: string
}

function NoteFormModal({ open, initial, onClose, onSaved, currentUserId }: NoteFormModalProps) {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [dealId,      setDealId]      = useState('')
  const [prospectId,  setProspectId]  = useState<string>('')
  const [deals,       setDeals]       = useState<{ id: string; name: string }[]>([])
  const [prospects,   setProspects]   = useState<{ id: string; firstname: string; lastname: string }[]>([])
  const [saving,      setSaving]      = useState(false)
  const [errors,      setErrors]      = useState<{ title?: string; description?: string }>({})

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setDealId(initial?.deal_id ?? '')
    setProspectId(initial?.prospect_id ?? '')
    setErrors({})

    async function loadOptions() {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from('deals').select('id, name').order('name'),
        supabase.from('prospects').select('id, firstname, lastname').order('firstname'),
      ])
      setDeals((d ?? []) as { id: string; name: string }[])
      setProspects((p ?? []) as { id: string; firstname: string; lastname: string }[])
    }
    loadOptions()
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (!description.trim()) errs.description = 'Note content is required'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      if (initial) {
        await notesService.updateNote(initial.id, { title: title.trim(), description: description.trim() })
        toast.success('Note updated')
      } else {
        await notesService.createNote({
          title:       title.trim(),
          description: description.trim(),
          deal_id:     dealId || null,
          prospect_id: prospectId || null,
          created_by:  currentUserId,
        })
        toast.success('Note created')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const selectCls = 'w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors'
  const labelCls  = 'text-xs font-semibold text-foreground'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initial ? 'Edit Note' : 'New Note'}
        className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground">{initial ? 'Edit Note' : 'New Note'}</h2>
          <button type="button" aria-label="Close" onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            <div className="space-y-1.5">
              <label className={labelCls}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note title…"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                autoFocus
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Content *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Write your note…"
                rows={6}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            {!initial && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Link to Deal</label>
                  <select title="Link to deal" value={dealId} onChange={e => { setDealId(e.target.value); if (e.target.value) setProspectId('') }} className={selectCls}>
                    <option value="">None</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Link to Prospect</label>
                  <select title="Link to prospect" value={prospectId} onChange={e => { setProspectId(e.target.value); if (e.target.value) setDealId('') }} className={selectCls}>
                    <option value="">None</option>
                    {prospects.map(p => <option key={p.id} value={p.id}>{p.firstname} {p.lastname}</option>)}
                  </select>
                </div>
              </div>
            )}

          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Note Card ──────────────────────────────────────────────────
function NoteCard({ note, onEdit, onDelete }: { note: NoteRow; onEdit: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const borderColor =
    note.deal_id      ? 'border-l-violet-500' :
    note.prospect_id  ? 'border-l-sky-500'    : 'border-l-amber-400'

  const entityLabel =
    note.deal_id && note.deals
      ? { icon: <Briefcase className="h-3 w-3" />, text: note.deals.name, color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30' }
      : note.prospect_id && note.prospects
        ? { icon: <User className="h-3 w-3" />, text: `${note.prospects.firstname} ${note.prospects.lastname}`, color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30' }
        : null

  return (
    <div className={cn('bg-card border border-border border-l-4 rounded-xl p-4 flex flex-col gap-3 group hover:shadow-md transition-shadow', borderColor)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <h3 className="text-sm font-semibold text-foreground truncate">{note.title}</h3>
        </div>
        <div className="relative shrink-0">
          <button type="button" title="Note actions"
            onClick={() => setMenuOpen(v => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-all">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[120px]">
              <button type="button" onClick={() => { setMenuOpen(false); onEdit() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors">
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onDelete() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {note.description && (
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {stripHtml(note.description)}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        {entityLabel ? (
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', entityLabel.color)}>
            {entityLabel.icon}
            <span className="truncate max-w-[120px]">{entityLabel.text}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
            <FileText className="h-3 w-3" /> Standalone
          </span>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(note.created_at)}</span>
      </div>
    </div>
  )
}

// ── Filter tab data ────────────────────────────────────────────
const FILTER_TABS: { key: NoteFilter; label: string }[] = [
  { key: 'all',        label: 'All Notes' },
  { key: 'deal',       label: 'Deal Notes' },
  { key: 'prospect',   label: 'Prospect Notes' },
  { key: 'standalone', label: 'Standalone' },
]

// ── Main Page ──────────────────────────────────────────────────
export function NotesPage() {
  const { user } = useAuth()
  const [filter,       setFilter]       = useState<NoteFilter>('all')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(0)
  const [notes,        setNotes]        = useState<NoteRow[]>([])
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<NoteRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NoteRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  const PAGE_SIZE = 24

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, count } = await notesService.getNotes(filter, search, page)
      setNotes(data)
      setTotalCount(count)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [filter, search, page])

  useEffect(() => { load() }, [load])

  // Reset page when filter or search changes
  useEffect(() => { setPage(0) }, [filter, search])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await notesService.deleteNote(deleteTarget.id)
      toast.success('Note deleted')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete note')
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <PageWrapper>
      <div className="flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Notes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : `${totalCount.toLocaleString()} note${totalCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditTarget(null); setModalOpen(true) }}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" /> New Note
          </button>
        </div>

        {/* Search + filter tabs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
            {search && (
              <button type="button" title="Clear search" onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'h-7 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  filter === tab.key
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="h-14 w-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <StickyNote className="h-7 w-7 text-brand-500" />
            </div>
            <p className="text-base font-semibold text-foreground">
              {search ? 'No notes match your search' : 'No notes yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {search ? 'Try a different keyword.' : 'Click "New Note" to capture your first note.'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => { setEditTarget(null); setModalOpen(true) }}
                className="mt-2 flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" /> New Note
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => { setEditTarget(note); setModalOpen(true) }}
                onDelete={() => setDeleteTarget(note)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <NoteFormModal
        open={modalOpen}
        initial={editTarget}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        currentUserId={user?.id ?? ''}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Delete note?</p>
                <p className="text-xs text-muted-foreground mt-0.5">"{deleteTarget.title}" will be permanently deleted.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 disabled:opacity-60 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-4 right-4 hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5 shadow-sm pointer-events-none">
        <Link2 className="h-3 w-3" />
        Notes linked to deals or prospects appear in their activity timeline
      </div>
    </PageWrapper>
  )
}
