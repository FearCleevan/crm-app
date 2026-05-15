import { useState, useMemo } from 'react'
import { UserPlus, Search, X, Pencil, Trash2, MoreHorizontal, ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/hooks/useUsers'
import { InviteUserModal } from '@/components/users/InviteUserModal'
import { EditUserModal } from '@/components/users/EditUserModal'
import { PermissionsMatrix } from '@/components/users/PermissionsMatrix'
import { Switch } from '@/components/ui/switch'
import type { CRMUserRow } from '@/types/database'
import { cn } from '@/lib/utils'

type Tab = 'users' | 'permissions'

const ROLE_BADGE: Record<CRMUserRow['role'], string> = {
  'Super Admin':  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'Data Analyst': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'Agent':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
}

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Delete User</p>
            <p className="text-xs text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete <span className="font-semibold text-foreground">{name}</span>? All their data and access will be removed.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 h-9 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function UserManagementPage() {
  const { user: me, hasPermission } = useAuth()
  const { data: users, loading, error, refetch, setActive, updateUser, remove } = useUsers()
  const [tab, setTab]               = useState<Tab>('users')
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editing, setEditing]       = useState<CRMUserRow | null>(null)
  const [deleting, setDeleting]     = useState<CRMUserRow | null>(null)
  const [openMenu, setOpenMenu]     = useState<string | null>(null)

  const filtered = useMemo(() => users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        (u.first_name ?? '').toLowerCase().includes(q) ||
        (u.last_name  ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
      )
    }
    return true
  }), [users, search, roleFilter])

  const canEdit = hasPermission('users_edit')

  async function handleToggleActive(u: CRMUserRow) {
    if (u.id === me?.id) { toast.error('You cannot deactivate your own account'); return }
    try {
      await setActive(u.id, !u.is_active)
      toast.success(`User ${!u.is_active ? 'activated' : 'deactivated'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  async function handleDelete(u: CRMUserRow) {
    if (u.id === me?.id) { toast.error('You cannot delete your own account'); return }
    try {
      await remove(u.id)
      toast.success('User deleted')
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
      setDeleting(null)
    }
  }

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <PermissionGate permission="users_create">
            <button type="button" onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <UserPlus className="h-3.5 w-3.5" /> Invite User
            </button>
          </PermissionGate>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">User Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{users.length} team members · {users.filter(u => u.is_active).length} active</p>
            </div>
            <PermissionGate permission="users_create">
              <button type="button" onClick={() => setInviteOpen(true)}
                className="md:hidden flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                <UserPlus className="h-3.5 w-3.5" /> Invite User
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Tabs + Filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card shrink-0 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-lg border border-border overflow-hidden">
            {([
              { id: 'users',       label: 'Users',       icon: null },
              { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
            ] as { id: Tab; label: string; icon: typeof ShieldCheck | null }[]).map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={cn('flex items-center gap-1.5 h-8 px-4 text-xs font-medium transition-colors',
                  tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
                {Icon && <Icon className="h-3.5 w-3.5" />}{label}
              </button>
            ))}
          </div>

          {tab === 'users' && (
            <>
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
                  className="w-full h-8 pl-8 pr-7 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                {search && (
                  <button type="button" aria-label="Clear search" onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {['all', 'Super Admin', 'Data Analyst', 'Agent'].map(r => (
                  <button key={r} type="button" onClick={() => setRoleFilter(r)}
                    className={cn('h-8 px-3 rounded-lg text-xs font-medium transition-colors border',
                      roleFilter === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent bg-card')}>
                    {r === 'all' ? 'All Roles' : r}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'users' && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading users…</span>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <AlertCircle className="h-8 w-8 text-rose-400" />
                  <p className="text-sm font-medium text-foreground">Failed to load users</p>
                  <p className="text-xs text-muted-foreground">{error.message}</p>
                </div>
              )}

              {!loading && !error && (
                <div>
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card border-b border-border z-10">
                      <tr>
                        {['User', 'Role', 'Department', 'Status', 'Last Login', ''].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(u => {
                        const isSelf = u.id === me?.id
                        return (
                          <tr key={u.id} className="border-b border-border hover:bg-muted/40 transition-colors group">
                            {/* User */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                {u.profile_url ? (
                                  <img src={u.profile_url} alt={u.first_name ?? ''} className="h-9 w-9 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300 shrink-0">
                                    {(u.first_name?.[0] ?? '?')}{(u.last_name?.[0] ?? '')}
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold text-foreground">{u.first_name} {u.last_name}</p>
                                    {isSelf && <span className="text-[10px] font-semibold bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded">You</span>}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{u.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Role */}
                            <td className="px-5 py-3.5">
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', ROLE_BADGE[u.role])}>
                                {u.role}
                              </span>
                            </td>

                            {/* Department */}
                            <td className="px-5 py-3.5 text-sm text-muted-foreground">{u.department || '—'}</td>

                            {/* Status toggle */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                {canEdit ? (
                                  <Switch
                                    checked={u.is_active}
                                    onCheckedChange={() => handleToggleActive(u)}
                                    aria-label={u.is_active ? 'Deactivate user' : 'Activate user'}
                                    size="sm"
                                  />
                                ) : null}
                                <span className={cn('text-xs font-medium', u.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                                  {u.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </td>

                            {/* Last login */}
                            <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                              {u.last_login
                                ? (() => { try { return format(new Date(u.last_login), 'MMM d, yyyy') } catch { return u.last_login } })()
                                : '—'}
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                              <div className="relative">
                                <button type="button" aria-label="User actions"
                                  onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                                  className="h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
                                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </button>
                                {openMenu === u.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                                    <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-border bg-card shadow-lg py-1">
                                      <PermissionGate permission="users_edit">
                                        <button type="button" onClick={() => { setEditing(u); setOpenMenu(null) }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors">
                                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                                        </button>
                                      </PermissionGate>
                                      <PermissionGate permission="users_delete">
                                        <button type="button"
                                          onClick={() => { if (!isSelf) setDeleting(u); setOpenMenu(null) }}
                                          disabled={isSelf}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition-colors">
                                          <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </button>
                                      </PermissionGate>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
                      <p className="font-medium">No users found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'permissions' && (
            <div className="p-6">
              <PermissionsMatrix canEdit={canEdit} />
            </div>
          )}
        </div>
      </PageWrapper>

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={newUser => {
          refetch()
          toast.success(`Invitation sent to ${newUser.email}`)
          setInviteOpen(false)
        }}
      />

      {editing && (
        <EditUserModal
          open
          user={editing}
          isSelf={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSave={async (id, updates) => {
            await updateUser(id, updates)
            setEditing(null)
          }}
        />
      )}

      {deleting && (
        <DeleteConfirm
          name={`${deleting.first_name ?? ''} ${deleting.last_name ?? ''}`.trim()}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}
