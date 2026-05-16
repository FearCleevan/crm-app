import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { EmailEditor } from './EmailEditor'
import type { EmailTemplate } from '@/constants/mockEmails'

const CATEGORIES = ['Outreach', 'Follow-up', 'Sales', 'Onboarding', 'Support', 'Newsletter', 'Other']

interface FormState {
  name: string
  category: string
  subject: string
  body: string
}

interface FormErrors {
  name?: string
  category?: string
  subject?: string
  body?: string
}

interface Props {
  open: boolean
  initial?: EmailTemplate | null
  onClose: () => void
  onSave: (data: Omit<EmailTemplate, 'id'>) => void
}

export function TemplateFormModal({ open, initial, onClose, onSave }: Props) {
  const ref = useFocusTrap(open)
  const [form, setForm] = useState<FormState>({ name: '', category: '', subject: '', body: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { name: initial.name, category: initial.category, subject: initial.subject, body: initial.body }
        : { name: '', category: '', subject: '', body: '' }
      )
      setErrors({})
      setSubmitted(false)
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function validate(f: FormState): FormErrors {
    const e: FormErrors = {}
    if (!f.name.trim()) e.name = 'Template name is required'
    if (!f.category) e.category = 'Category is required'
    if (!f.subject.trim()) e.subject = 'Subject line is required'
    if (!f.body.replace(/<[^>]*>/g, '').trim()) e.body = 'Body content is required'
    return e
  }

  function handleChange(field: keyof FormState, value: string) {
    const next = { ...form, [field]: value }
    setForm(next)
    if (submitted) setErrors(validate(next))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave({ name: form.name.trim(), category: form.category, subject: form.subject.trim(), body: form.body.trim() })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? 'Edit Template' : 'New Template'}
        className="relative z-10 w-full sm:max-w-xl bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground">
            {initial ? 'Edit Template' : 'New Template'}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            <div className="space-y-1.5">
              <label htmlFor="tpl-name" className="text-xs font-semibold text-foreground">
                Template Name *
              </label>
              <input
                id="tpl-name"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="e.g. Welcome Email"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tpl-category" className="text-xs font-semibold text-foreground">
                Category *
              </label>
              <select
                id="tpl-category"
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tpl-subject" className="text-xs font-semibold text-foreground">
                Email Subject *
              </label>
              <input
                id="tpl-subject"
                value={form.subject}
                onChange={e => handleChange('subject', e.target.value)}
                placeholder="e.g. Welcome to Brisk CRM, {{first_name}}!"
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Body *</label>
              <p className="text-[11px] text-muted-foreground">
                Use{' '}
                <code className="font-mono bg-muted px-1 rounded text-[11px]">{'{{variable_name}}'}</code>
                {' '}for dynamic content (e.g. {'{{first_name}}'}).
              </p>
              <EmailEditor
                key={open ? (initial?.id ?? 'new') : 'closed'}
                content={form.body}
                onChange={html => handleChange('body', html)}
                placeholder="Hi {{first_name}}, your message here…"
                minHeight="200px"
              />
              {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
            </div>

          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {initial ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
