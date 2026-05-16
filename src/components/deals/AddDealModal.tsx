import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_USERS, MOCK_PROSPECTS, type Deal } from '@/constants/mockData'
import { PIPELINE_STAGES } from './PipelineBoard'

const schema = z.object({
  name:               z.string().min(1, 'Deal name is required'),
  prospectId:         z.string().min(1, 'Linked prospect is required'),
  stage:              z.enum(['New Lead','Contacted','Qualified','Proposal Sent','Negotiation','Closed Won','Closed Lost']),
  value:              z.coerce.number().min(0, 'Value must be 0 or more'),
  probability:        z.coerce.number().min(0).max(100),
  expectedCloseDate:  z.string().min(1, 'Close date is required'),
  assignedTo:         z.string().min(1, 'Assignee is required'),
  description:        z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
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
  onAdd: (deal: Deal) => void
  userId: string
}

export function AddDealModal({ open, onClose, onAdd, userId }: AddDealModalProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { stage: 'New Lead', probability: 10, assignedTo: userId },
  })

  if (!open) return null

  function onSubmit(data: FormValues) {
    const prospect = MOCK_PROSPECTS.find(p => p.id === data.prospectId)
    const deal: Deal = {
      id: `deal-${Date.now()}`,
      name: data.name,
      prospectId: data.prospectId,
      prospectName: prospect?.fullname ?? '',
      company: prospect?.company ?? '',
      stage: data.stage,
      value: data.value,
      probability: data.probability,
      expectedCloseDate: data.expectedCloseDate,
      assignedTo: data.assignedTo,
      daysInStage: 0,
      description: data.description ?? '',
      createdOn: new Date().toISOString(),
    }
    onAdd(deal)
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Add Deal</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a new deal in the pipeline</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          <Field label="Deal Name" required error={errors.name?.message}>
            <input {...register('name')} placeholder="Acme Corp — Enterprise Plan" className={inputCls(!!errors.name)} />
          </Field>

          <Field label="Linked Prospect" required error={errors.prospectId?.message}>
            <select {...register('prospectId')} className={inputCls(!!errors.prospectId)}>
              <option value="">Select prospect…</option>
              {MOCK_PROSPECTS.slice(0, 55).map(p => (
                <option key={p.id} value={p.id}>{p.fullname} — {p.company}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage" required error={errors.stage?.message}>
              <select {...register('stage')} className={inputCls(!!errors.stage)}>
                {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Assigned To" required error={errors.assignedTo?.message}>
              <select {...register('assignedTo')} className={inputCls(!!errors.assignedTo)}>
                {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
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
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="submit" form="" disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {isSubmitting ? 'Creating…' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
