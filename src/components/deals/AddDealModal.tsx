import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, AlertCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { prospectsService } from '@/services/prospects.service'
import { PIPELINE_STAGES } from './PipelineBoard'
import type { DealInsert, CRMUserRow } from '@/types/database'
import type { ProspectRow } from '@/types/database'

const schema = z.object({
  name:               z.string().min(1, 'Deal name is required'),
  stage:              z.enum(['New Lead','Contacted','Qualified','Proposal Sent','Negotiation','Closed Won','Closed Lost']),
  value:              z.coerce.number().min(0, 'Value must be 0 or more'),
  probability:        z.coerce.number().min(0).max(100),
  expectedCloseDate:  z.string().min(1, 'Close date is required'),
  assignedTo:         z.string().optional(),
  description:        z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-rose-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{error}
        </p>
      )}
    </div>
  )
}

const inputCls = (err?: boolean) => cn(
  'w-full h-9 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
  err ? 'border-rose-500' : 'border-input hover:border-muted-foreground',
)

interface AddDealModalProps {
  open: boolean
  onClose: () => void
  onAdd: (payload: DealInsert) => Promise<void>
  userId: string
  users: CRMUserRow[]
}

// Debounce helper
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function AddDealModal({ open, onClose, onAdd, userId, users }: AddDealModalProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { stage: 'New Lead', probability: 10, assignedTo: userId },
  })

  // Prospect typeahead
  const [prospectSearch, setProspectSearch] = useState('')
  const [prospectSuggestions, setProspectSuggestions] = useState<ProspectRow[]>([])
  const [selectedProspect, setSelectedProspect] = useState<ProspectRow | null>(null)
  const [prospectError, setProspectError] = useState('')
  const debouncedSearch = useDebounce(prospectSearch, 250)

  useEffect(() => {
    if (!open) return
    if (debouncedSearch.length < 2) { setProspectSuggestions([]); return }
    prospectsService.getProspects({ search: debouncedSearch, limit: 8 })
      .then(r => setProspectSuggestions(r.data))
      .catch(() => setProspectSuggestions([]))
  }, [debouncedSearch, open])

  const selectProspect = useCallback((p: ProspectRow) => {
    setSelectedProspect(p)
    setProspectSearch(`${p.fullname ?? ''} — ${p.company ?? ''}`)
    setProspectSuggestions([])
    setProspectError('')
  }, [])

  function handleClose() {
    reset()
    setProspectSearch('')
    setSelectedProspect(null)
    setProspectSuggestions([])
    setProspectError('')
    onClose()
  }

  async function onSubmit(data: FormValues) {
    if (!selectedProspect) {
      setProspectError('Please select a prospect from the list')
      return
    }
    const payload: DealInsert = {
      name:               data.name,
      prospect_id:        selectedProspect.id,
      prospect_name:      selectedProspect.fullname ?? '',
      company:            selectedProspect.company ?? '',
      stage:              data.stage,
      value:              data.value,
      probability:        data.probability,
      expected_close_date: data.expectedCloseDate,
      assigned_to:        data.assignedTo || null,
      sort_order:         0,
      description:        data.description ?? null,
      created_by:         userId || null,
      stage_changed_at:   new Date().toISOString(),
    }
    await onAdd(payload)
    handleClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Add Deal</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a new deal in the pipeline</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close modal"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto px-6 py-5 space-y-4 flex-1">

          <Field label="Deal Name" required error={errors.name?.message}>
            <input {...register('name')} placeholder="Acme Corp — Enterprise Plan" className={inputCls(!!errors.name)} />
          </Field>

          {/* Prospect typeahead */}
          <Field label="Linked Prospect" required error={prospectError}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={prospectSearch}
                onChange={e => {
                  setProspectSearch(e.target.value)
                  setSelectedProspect(null)
                }}
                placeholder="Search by name, email, company…"
                className={cn(inputCls(!!prospectError), 'pl-8')}
              />
              {prospectSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                  {prospectSuggestions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => selectProspect(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                        {(p.firstname?.[0] ?? '').toUpperCase()}{(p.lastname?.[0] ?? '').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.fullname}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.company} · {p.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedProspect && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                ✓ {selectedProspect.fullname} selected
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage" required error={errors.stage?.message}>
              <select {...register('stage')} className={inputCls(!!errors.stage)}>
                {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Assigned To" error={errors.assignedTo?.message}>
              <select {...register('assignedTo')} className={inputCls(!!errors.assignedTo)}>
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Value ($)" required error={errors.value?.message}>
              <input {...register('value')} type="number" min={0} placeholder="50000" className={inputCls(!!errors.value)} />
            </Field>
            <Field label="Probability (%)">
              <input {...register('probability')} type="number" min={0} max={100} placeholder="40" className={inputCls()} />
            </Field>
          </div>

          <Field label="Expected Close Date" required error={errors.expectedCloseDate?.message}>
            <input {...register('expectedCloseDate')} type="date" className={inputCls(!!errors.expectedCloseDate)} />
          </Field>

          <Field label="Description">
            <textarea {...register('description')} rows={3} placeholder="Brief deal description…"
              className={cn(inputCls(), 'h-auto py-2 resize-none')} />
          </Field>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={handleClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? 'Creating…' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
