import { useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { ProspectForm, formValuesToProspect, type ProspectFormValues } from './ProspectForm'
import type { Prospect } from '@/constants/mockData'
import { cn } from '@/lib/utils'

interface AddProspectModalProps {
  open: boolean
  onClose: () => void
  onAdd: (p: Prospect) => void
  userId: string
}

export function AddProspectModal({ open, onClose, onAdd, userId }: AddProspectModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(data: ProspectFormValues) {
    setIsLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const newProspect: Prospect = {
      ...formValuesToProspect(data, userId),
      id: `prs-${Date.now()}`,
    }
    onAdd(newProspect)
    toast.success(`${newProspect.fullname} added successfully`)
    onClose()
    setIsLoading(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Modal */}
      <div className={cn(
        'relative z-10 w-full max-w-2xl max-h-[90vh] bg-card rounded-2xl border border-border shadow-2xl flex flex-col',
        'animate-in fade-in-0 zoom-in-95 duration-200'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Add Prospect</p>
              <p className="text-xs text-muted-foreground">Fill in the details below</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ProspectForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel="Add Prospect"
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
