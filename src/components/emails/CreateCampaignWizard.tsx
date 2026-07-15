import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ProspectSelector } from '@/components/prospects/ProspectSelector'
import type { Campaign, RichTemplateDB } from '@/types/campaigns'

const step1Schema = z.object({
  name:        z.string().min(3, 'Min 3 chars'),
  description: z.string().optional(),
  daily_limit: z.number().min(10).max(200),
  start_date:  z.string().min(1),
})
type Step1Values = z.infer<typeof step1Schema>

export type CampaignFormData = {
  name: string
  description?: string
  template_id?: string
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
  status: Campaign['status']
  total_recipients: number
  prospectIds: number[]
}

interface Props {
  open: boolean
  templates: RichTemplateDB[]
  initial?: Campaign | null
  onClose: () => void
  onSave: (campaign: CampaignFormData) => void
}

export function CreateCampaignWizard({ open, templates, initial, onClose, onSave }: Props) {
  const [step, setStep]                         = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<RichTemplateDB | null>(null)
  const [prospectIds, setProspectIds]           = useState<number[]>([])
  const isEdit = !!initial

  const { register, handleSubmit, formState: { errors }, watch } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name:        initial?.name        ?? '',
      description: '',
      daily_limit: 50,
      start_date:  new Date().toISOString().split('T')[0],
    },
  })

  const watchedLimit = watch('daily_limit')
  const estDays = prospectIds.length > 0 ? Math.ceil(prospectIds.length / (watchedLimit || 50)) : 0

  if (!open) return null

  function handleClose() {
    if (!confirm('Discard this campaign?')) return
    setStep(1); setSelectedTemplate(null); setProspectIds([])
    onClose()
  }

  function submitStep1(values: Step1Values) {
    if (step < 4) setStep(s => s + 1)
    else handleLaunch(values, 'active')
  }

  function handleLaunch(values: Step1Values, status: Campaign['status']) {
    onSave({
      name:             values.name,
      description:      values.description,
      template_id:      selectedTemplate?.id,
      daily_limit:      values.daily_limit,
      send_from_hour:   8,
      send_to_hour:     18,
      send_days:        ['mon', 'tue', 'wed', 'thu', 'fri'],
      warmup_enabled:   false,
      status,
      total_recipients: prospectIds.length,
      prospectIds,
    })
    setStep(1); setSelectedTemplate(null); setProspectIds([])
  }

  const STEPS = ['Campaign Details', 'Select Template', 'Select Prospects', 'Review & Launch']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Campaign' : 'New Campaign'}
        className="relative z-10 w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h2>
            {!isEdit && <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 4 — {STEPS[step - 1]}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={handleClose}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        {!isEdit && (
          <div className="px-5 pt-3 pb-1 shrink-0">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Step 1 */}
          {step === 1 && (
            <form id="step1form" onSubmit={handleSubmit(submitStep1)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Campaign Name *</label>
                <input {...register('name')} placeholder="e.g. US Small Business Outreach"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea {...register('description')} rows={2} placeholder="Optional description…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Daily Send Limit (10–200)</label>
                <input type="number" {...register('daily_limit', { valueAsNumber: true })} min={10} max={200}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                {Number(watchedLimit) > 100 && (
                  <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">High send volume may increase spam risk for new domains. We recommend starting at 50/day.</p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Start Date</label>
                <input type="date" {...register('start_date')}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-foreground">Choose a template *</p>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates yet. Create one first.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map(t => (
                    <button key={t.id} type="button" onClick={() => setSelectedTemplate(t)}
                      className={`text-left p-4 rounded-xl border-2 transition-colors ${selectedTemplate?.id === t.id ? 'border-primary bg-brand-50/50 dark:bg-brand-900/10' : 'border-border hover:border-brand-300'}`}>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{t.subject}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="h-96 border border-border rounded-xl overflow-hidden">
              <ProspectSelector
                onConfirm={ids => { setProspectIds(ids); setStep(4) }}
                onCancel={() => setStep(2)}
              />
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground mb-4">Review your campaign</p>
              {[
                ['Template',        selectedTemplate?.name ?? '—'],
                ['Recipients',      `${prospectIds.length} prospects`],
                ['Daily Limit',     `${watchedLimit} emails/day`],
                ['Est. Completion', estDays > 0 ? `${estDays} day${estDays > 1 ? 's' : ''}` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium text-foreground">{value}</span>
                </div>
              ))}
              {prospectIds.length > 200 && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">Large batches may take several days to complete.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          <button type="button" onClick={() => step > 1 ? setStep(s => s - 1) : handleClose()}
            className="h-8 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step === 4 ? (
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { const v = { name: watch('name'), description: '', daily_limit: watchedLimit, start_date: watch('start_date') }; handleLaunch(v as Step1Values, 'draft') }}
                className="h-8 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
                Save as Draft
              </button>
              <button type="button"
                onClick={() => { const v = { name: watch('name'), description: '', daily_limit: watchedLimit, start_date: watch('start_date') }; handleLaunch(v as Step1Values, 'active') }}
                className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                Launch Campaign
              </button>
            </div>
          ) : step === 2 ? (
            <button type="button" disabled={!selectedTemplate} onClick={() => setStep(3)}
              className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              Next →
            </button>
          ) : step === 3 ? null : (
            <button type="submit" form="step1form"
              className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
