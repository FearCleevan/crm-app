import { useState } from 'react'
import { Save, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ROLE_PERMISSIONS, type PermissionKey, type RoleName } from '@/constants/roles'

const ROLES: RoleName[] = ['Super Admin', 'Data Analyst', 'Agent']

const MODULES: { label: string; permissions: { key: PermissionKey; label: string }[] }[] = [
  {
    label: 'Prospects / Leads',
    permissions: [
      { key: 'leads_view',   label: 'View' },
      { key: 'leads_create', label: 'Create' },
      { key: 'leads_edit',   label: 'Edit' },
      { key: 'leads_delete', label: 'Delete' },
      { key: 'leads_import', label: 'Import' },
      { key: 'leads_export', label: 'Export' },
    ],
  },
  {
    label: 'Deals',
    permissions: [
      { key: 'deals_view',   label: 'View' },
      { key: 'deals_create', label: 'Create' },
      { key: 'deals_edit',   label: 'Edit' },
      { key: 'deals_delete', label: 'Delete' },
    ],
  },
  {
    label: 'Reports',
    permissions: [
      { key: 'reports_view', label: 'View' },
    ],
  },
  {
    label: 'Emails',
    permissions: [
      { key: 'emails_view', label: 'View' },
      { key: 'emails_send', label: 'Send' },
    ],
  },
  {
    label: 'Workflows',
    permissions: [
      { key: 'workflows_view',   label: 'View' },
      { key: 'workflows_manage', label: 'Manage' },
    ],
  },
  {
    label: 'Users',
    permissions: [
      { key: 'users_view',   label: 'View' },
      { key: 'users_create', label: 'Create' },
      { key: 'users_edit',   label: 'Edit' },
      { key: 'users_delete', label: 'Delete' },
    ],
  },
  {
    label: 'Settings',
    permissions: [
      { key: 'settings_view',   label: 'View' },
      { key: 'settings_manage', label: 'Manage' },
      { key: 'ip_manage',       label: 'IP Manage' },
    ],
  },
]

const ROLE_HEADER_COLORS: Record<RoleName, string> = {
  'Super Admin':  'text-violet-600 dark:text-violet-400',
  'Data Analyst': 'text-blue-600 dark:text-blue-400',
  'Agent':        'text-emerald-600 dark:text-emerald-400',
}

interface PermissionsMatrixProps {
  canEdit: boolean
}

export function PermissionsMatrix({ canEdit }: PermissionsMatrixProps) {
  const [matrix, setMatrix] = useState<Record<RoleName, Set<PermissionKey>>>(() => ({
    'Super Admin':  new Set(ROLE_PERMISSIONS['Super Admin']),
    'Data Analyst': new Set(ROLE_PERMISSIONS['Data Analyst']),
    'Agent':        new Set(ROLE_PERMISSIONS['Agent']),
  }))
  const [dirty, setDirty] = useState(false)

  function toggle(role: RoleName, key: PermissionKey) {
    if (!canEdit) return
    if (role === 'Super Admin') return // Super Admin always has all permissions
    setMatrix(prev => {
      const next = new Set(prev[role])
      next.has(key) ? next.delete(key) : next.add(key)
      return { ...prev, [role]: next }
    })
    setDirty(true)
  }

  function handleSave() {
    toast.success('Permission matrix saved')
    setDirty(false)
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Role Permissions Matrix</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canEdit ? 'Click checkboxes to modify role permissions' : 'Read-only — Super Admin access required to edit'}
          </p>
        </div>
        {canEdit && dirty && (
          <button type="button" onClick={handleSave}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
            <Save className="h-3.5 w-3.5" /> Save Changes
          </button>
        )}
        {!canEdit && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> View only
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-48">Permission</th>
              {ROLES.map(role => (
                <th key={role} className={cn('px-4 py-3 text-center text-xs font-bold uppercase tracking-wide', ROLE_HEADER_COLORS[role])}>
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(mod => (
              <>
                {/* Module header row */}
                <tr key={`mod-${mod.label}`} className="bg-muted/20 border-t border-border">
                  <td colSpan={4} className="px-5 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {mod.label}
                  </td>
                </tr>
                {mod.permissions.map(({ key, label }) => (
                  <tr key={key} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5 text-sm text-foreground pl-8">{label}</td>
                    {ROLES.map(role => {
                      const checked = matrix[role].has(key)
                      const locked  = role === 'Super Admin'
                      return (
                        <td key={role} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(role, key)}
                            disabled={locked || !canEdit}
                            aria-label={`${role} - ${label}`}
                            className={cn(
                              'h-4 w-4 rounded border-border accent-primary cursor-pointer',
                              (locked || !canEdit) && 'cursor-not-allowed opacity-60',
                            )}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
