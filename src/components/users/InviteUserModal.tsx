import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, UserPlus, AlertCircle, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CRMUser } from '@/constants/mockData'

const schema = z.object({
  first_name:  z.string().min(1, 'First name is required'),
  last_name:   z.string().min(1, 'Last name is required'),
  email:       z.string().min(1, 'Email is required').email('Enter a valid email'),
  role:        z.enum(['Super Admin', 'Data Analyst', 'Agent']),
  department:  z.string().optional(),
  phone_no:    z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-500 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{error}</p>}
    </div>
  )
}

const inputCls = (err?: boolean) => cn(
  'w-full h-9 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
  err ? 'border-rose-500' : 'border-input hover:border-muted-foreground',
)

interface InviteUserModalProps {
  open: boolean
  onClose: () => void
  onInvite: (user: CRMUser) => void
}

export function InviteUserModal({ open, onClose, onInvite }: InviteUserModalProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'Agent' },
  })

  if (!open) return null

  async function onSubmit(data: FormValues) {
    await new Promise(r => setTimeout(r, 500))
    const newUser: CRMUser = {
      id: `usr-${Date.now()}`,
      first_name:  data.first_name,
      last_name:   data.last_name,
      email:       data.email,
      role:        data.role,
      permissions: [],
      last_login:  '—',
      is_active:   false,
      profile_url: '',
      department:  data.department ?? '',
      phone_no:    data.phone_no ?? '',
    }
    onInvite(newUser)
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Invite User</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Send an invitation to join the CRM</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required error={errors.first_name?.message}>
              <input {...register('first_name')} placeholder="Alice" className={inputCls(!!errors.first_name)} />
            </Field>
            <Field label="Last Name" required error={errors.last_name?.message}>
              <input {...register('last_name')} placeholder="Johnson" className={inputCls(!!errors.last_name)} />
            </Field>
          </div>

          <Field label="Email Address" required error={errors.email?.message}>
            <input {...register('email')} type="email" placeholder="alice@company.com" className={inputCls(!!errors.email)} />
          </Field>

          <Field label="Role" required error={errors.role?.message}>
            <select {...register('role')} className={inputCls(!!errors.role)}>
              <option value="Super Admin">Super Admin</option>
              <option value="Data Analyst">Data Analyst</option>
              <option value="Agent">Agent</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <input {...register('department')} placeholder="Sales" className={inputCls()} />
            </Field>
            <Field label="Phone">
              <input {...register('phone_no')} placeholder="+61 400 000 000" className={inputCls()} />
            </Field>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
            <Mail className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
            <p className="text-xs text-brand-700 dark:text-brand-300">
              An invitation email will be sent to the address above. The user can set their own password upon first login.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            {isSubmitting ? 'Sending…' : 'Send Invitation'}
          </button>
        </div>
      </div>
    </div>
  )
}
