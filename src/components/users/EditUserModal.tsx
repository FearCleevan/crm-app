import { useState } from 'react'
import { X, Pencil, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { CRMUserRow } from '@/types/database'

const ROLE_BADGE: Record<CRMUserRow['role'], string> = {
  'Super Admin':  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'Data Analyst': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'Agent':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
}

const selectCls = cn(
  'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
)
const inputCls = cn(
  'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
)

interface EditUserModalProps {
  open: boolean
  user: CRMUserRow
  isSelf: boolean
  onClose: () => void
  onSave: (id: string, updates: Partial<CRMUserRow>) => Promise<void>
}

export function EditUserModal({ open, user, isSelf, onClose, onSave }: EditUserModalProps) {
  const [role, setRole]         = useState<CRMUserRow['role']>(user.role)
  const [isActive, setIsActive] = useState(user.is_active)
  const [department, setDept]   = useState(user.department ?? '')
  const [phone, setPhone]       = useState(user.phone_no ?? '')
  const [saving, setSaving]     = useState(false)

  if (!open) return null

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(user.id, { role, is_active: isActive, department: department || null, phone_no: phone || null })
      toast.success('User updated')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Edit User</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{user.first_name} {user.last_name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* User info (read-only) */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-sm font-bold text-brand-700 dark:text-brand-300 shrink-0">
              {(user.first_name?.[0] ?? '?')}{(user.last_name?.[0] ?? '')}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{user.first_name} {user.last_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className={cn('ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', ROLE_BADGE[user.role])}>
              {user.role}
            </span>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label htmlFor="edit-user-role" className="text-xs font-semibold text-foreground">Role</label>
            {isSelf ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">You cannot change your own role.</p>
              </div>
            ) : (
              <select id="edit-user-role" value={role} onChange={e => setRole(e.target.value as CRMUserRow['role'])} className={selectCls}>
                <option value="Super Admin">Super Admin</option>
                <option value="Data Analyst">Data Analyst</option>
                <option value="Agent">Agent</option>
              </select>
            )}
          </div>

          {/* Department + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Department</label>
              <input value={department} onChange={e => setDept(e.target.value)} placeholder="Sales" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+61 400 000 000" className={inputCls} />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
            <div>
              <p className="text-sm font-semibold text-foreground">Account Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isActive ? 'User can log in and access the CRM' : 'User is deactivated and cannot log in'}
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={v => {
                if (isSelf && !v) { toast.error('You cannot deactivate your own account'); return }
                setIsActive(v)
              }}
              aria-label="Toggle account active status"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
