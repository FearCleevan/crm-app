import { useState } from 'react'
import { X, UserPlus, AlertTriangle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { ProspectForm, type ProspectFormValues } from './ProspectForm'
import { prospectsService } from '@/services/prospects.service'
import { cn } from '@/lib/utils'
import type { ProspectRow } from '@/types/database'

interface AddProspectModalProps {
  open: boolean
  onClose: () => void
  onAdd: (values: ProspectFormValues) => Promise<void>
  onMerge?: (existingId: number, values: ProspectFormValues) => Promise<void>
}

export function AddProspectModal({ open, onClose, onAdd, onMerge }: AddProspectModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  // When an email duplicate is detected we hold the conflicting row + form values here
  const [duplicate, setDuplicate]       = useState<ProspectRow | null>(null)
  const [pendingValues, setPendingValues] = useState<ProspectFormValues | null>(null)

  function handleClose() {
    setDuplicate(null)
    setPendingValues(null)
    onClose()
  }

  async function handleSubmit(data: ProspectFormValues) {
    setIsLoading(true)
    try {
      // ── Check for duplicate email first ───────────────────
      if (data.email) {
        const map = await prospectsService.findByEmails([data.email.toLowerCase()])
        const existing = map.get(data.email.toLowerCase())
        if (existing) {
          setDuplicate(existing)
          setPendingValues(data)
          return // don't proceed — show the duplicate warning instead
        }
      }
      await onAdd(data)
      onClose()
    } catch {
      toast.error('Failed to add prospect')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMerge() {
    if (!duplicate || !pendingValues) return
    setIsLoading(true)
    try {
      if (onMerge) {
        await onMerge(duplicate.id, pendingValues)
      } else {
        toast.info('Merge not available — open the existing record to edit it.')
      }
      setDuplicate(null)
      setPendingValues(null)
      onClose()
    } catch {
      toast.error('Failed to merge prospect')
    } finally {
      setIsLoading(false)
    }
  }

  function handleGoBack() {
    setDuplicate(null)
    setPendingValues(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      <div className={cn(
        'relative z-10 w-full max-w-2xl max-h-[90vh] bg-card rounded-2xl border border-border shadow-2xl flex flex-col',
        'animate-in fade-in-0 zoom-in-95 duration-200'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Add Prospect</p>
              <p className="text-xs text-muted-foreground">
                {duplicate ? 'Duplicate email detected' : 'Fill in the details below'}
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Duplicate warning ──────────────────────────── */}
          {duplicate ? (
            <div className="space-y-5">
              <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    This email already exists in your database
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    A prospect with{' '}
                    <span className="font-medium">{pendingValues?.email}</span>{' '}
                    was found:
                  </p>
                </div>
              </div>

              {/* Existing record card */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Existing Record</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {[
                    { label: 'Name',    value: duplicate.fullname ?? `${duplicate.firstname ?? ''} ${duplicate.lastname ?? ''}`.trim() },
                    { label: 'Company', value: duplicate.company },
                    { label: 'Email',   value: duplicate.email },
                    { label: 'Job Title', value: duplicate.jobtitle },
                    { label: 'Status',  value: duplicate.status },
                    { label: 'Country', value: duplicate.country },
                  ].map(row => row.value ? (
                    <div key={row.label}>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{row.label}</p>
                      <p className="text-sm text-foreground truncate">{row.value}</p>
                    </div>
                  ) : null)}
                </div>
              </div>

              {/* What to do */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">What would you like to do?</p>

                <button type="button" onClick={handleMerge} disabled={isLoading}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors text-left disabled:opacity-60">
                  <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
                    <ArrowRight className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                      Merge into existing record
                    </p>
                    <p className="text-xs text-brand-600 dark:text-brand-400">
                      Fills in blank fields on the existing record with your new data. Existing data is preserved.
                    </p>
                  </div>
                </button>

                <button type="button" onClick={handleGoBack}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-accent transition-colors text-left">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Go back and edit</p>
                    <p className="text-xs text-muted-foreground">
                      Return to the form to change the email or other details.
                    </p>
                  </div>
                </button>
              </div>
            </div>

          ) : (
            /* ── Normal form ──────────────────────────────── */
            <ProspectForm
              onSubmit={handleSubmit}
              onCancel={handleClose}
              submitLabel="Add Prospect"
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  )
}
