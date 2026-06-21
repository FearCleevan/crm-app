// src/components/emails/TemplateModal.tsx
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { VariableChips } from './VariableChips'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'
import type { RichTemplateDB } from '@/types/campaigns'

const SAMPLE = { first_name: 'John', company: 'Acme Corp', job_title: 'CEO', website: 'acmecorp.com', last_name: 'Smith', my_name: 'Peter Lazan', my_portfolio: 'lazandev.vercel.app' }

function resolvePreview(text: string): string {
  return text
    .replace(/{{first_name}}/g, SAMPLE.first_name)
    .replace(/{{last_name}}/g,  SAMPLE.last_name)
    .replace(/{{company}}/g,    SAMPLE.company)
    .replace(/{{job_title}}/g,  SAMPLE.job_title)
    .replace(/{{website}}/g,    SAMPLE.website)
    .replace(/{{my_name}}/g,    SAMPLE.my_name)
    .replace(/{{my_portfolio}}/g, SAMPLE.my_portfolio)
}

function highlightUnresolved(text: string): string {
  return resolvePreview(text).replace(
    /{{[^}]+}}/g,
    m => `<span class="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1 rounded">${m}</span>`
  )
}

const schema = z.object({
  name:     z.string().min(3, 'Min 3 chars').max(100, 'Max 100 chars'),
  category: z.string().min(1, 'Required'),
  subject:  z.string().min(1, 'Required').max(255, 'Max 255 chars'),
  body:     z.string().min(1, 'Required'),
})
type FormValues = z.infer<typeof schema>

export type TemplateFormData = Pick<RichTemplateDB, 'name' | 'category' | 'subject' | 'body' | 'variables'>

interface Props {
  open: boolean
  initial: RichTemplateDB | null
  existingNames: string[]
  onClose: () => void
  onSave: (data: TemplateFormData) => void
}

export function TemplateModal({ open, initial, existingNames, onClose, onSave }: Props) {
  const [tab, setTab]         = useState<'edit' | 'preview'>('edit')
  const [dirty, setDirty]     = useState(false)
  const bodyRef               = useRef<HTMLTextAreaElement>(null)

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? { name: '', category: 'cold_outreach', subject: '', body: '' },
  })

  useEffect(() => { if (open) { reset(initial ?? { name: '', category: 'cold_outreach', subject: '', body: '' }); setTab('edit'); setDirty(false) } }, [open, initial, reset])
  useEffect(() => { function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose() }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey) })

  function handleClose() {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return
    onClose()
  }

  function insertVariable(variable: string) {
    const el = bodyRef.current
    if (!el) { setValue('body', watch('body') + variable, { shouldDirty: true }); return }
    const start = el.selectionStart ?? el.value.length
    const end   = el.selectionEnd   ?? el.value.length
    const next  = el.value.slice(0, start) + variable + el.value.slice(end)
    setValue('body', next, { shouldDirty: true })
    setDirty(true)
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + variable.length }, 0)
  }

  function onSubmit(values: FormValues) {
    const isDupe = existingNames
      .filter(n => !initial || n !== initial.name)
      .includes(values.name.trim())
    if (isDupe) { alert('A template with this name already exists.'); return }
    onSave({ name: values.name.trim(), category: values.category, subject: values.subject, body: values.body, variables: [] })
    setDirty(false)
  }

  const bodyValue = watch('body')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={initial ? 'Edit Template' : 'New Template'}
        className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground">{initial ? 'Edit Template' : 'New Template'}</h2>
          <button type="button" aria-label="Close" onClick={handleClose}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-border px-5 shrink-0">
          {(['edit','preview'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`h-9 px-3 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} onChange={() => setDirty(true)} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
            {tab === 'edit' ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Template Name</label>
                  <input {...register('name')} placeholder="e.g. No Website Cold Outreach"
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select {...register('category')}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    {TEMPLATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Subject</label>
                  <input {...register('subject')} placeholder="e.g. Quick question about {{company}}"
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                  {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Body</label>
                  <VariableChips onInsert={insertVariable} />
                  <textarea
                    {...register('body')}
                    ref={(el) => { (register('body') as { ref: (el: HTMLTextAreaElement | null) => void }).ref(el); (bodyRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el }}
                    rows={8}
                    placeholder="Write your email body..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
                  />
                  {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Subject preview</p>
                <p className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2"
                  dangerouslySetInnerHTML={{ __html: highlightUnresolved(watch('subject')) }} />
                <p className="text-xs font-semibold text-foreground mt-3">Body preview</p>
                <div className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-3 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: highlightUnresolved(bodyValue).replace(/\n/g, '<br/>') }} />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
            <span className="text-xs text-muted-foreground">{bodyValue?.length ?? 0} chars</span>
            <div className="flex gap-2">
              <button type="button" onClick={handleClose}
                className="h-8 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                Save Template
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
