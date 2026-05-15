import { useState } from 'react'
import { Plus, Trash2, Shield, Globe, AlertCircle, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { useIPManagement } from '@/hooks/useIPManagement'
import { useIPCheck } from '@/hooks/useIPCheck'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type { IPEntryRow } from '@/types/database'

const inputCls = (err?: boolean) => cn(
  'w-full h-9 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
  err ? 'border-rose-500' : 'border-input hover:border-muted-foreground',
)

// ── Add IP Modal ───────────────────────────────────────────────
interface AddIpModalProps {
  listType: 'whitelist' | 'blacklist'
  prefillIp?: string
  onClose: () => void
  onAdd: (ip: string, description: string) => Promise<void>
}

function AddIpModal({ listType, prefillIp = '', onClose, onAdd }: AddIpModalProps) {
  const [ip, setIp]           = useState(prefillIp)
  const [desc, setDesc]       = useState('')
  const [ipError, setIpError] = useState('')
  const [saving, setSaving]   = useState(false)

  function validate() {
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    if (!ip.trim()) { setIpError('IP address is required'); return false }
    if (!ipv4.test(ip.trim())) { setIpError('Enter a valid IPv4 address or CIDR block'); return false }
    return true
  }

  async function handleAdd() {
    if (!validate()) return
    setSaving(true)
    try {
      await onAdd(ip.trim(), desc.trim())
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add IP')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Add to {listType === 'whitelist' ? 'Whitelist' : 'Blacklist'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">IP Address / CIDR</label>
            <input value={ip} onChange={e => { setIp(e.target.value); setIpError('') }}
              placeholder="192.168.1.1 or 10.0.0.0/24"
              className={inputCls(!!ipError)} />
            {ipError && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{ipError}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="e.g. Office network"
              className={inputCls()} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleAdd} disabled={saving}
            className={cn(
              'flex-1 h-9 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60',
              listType === 'whitelist'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-rose-500 hover:bg-rose-600 text-white',
            )}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Add IP'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── IP Table ───────────────────────────────────────────────────
interface IpTableProps {
  title: string
  color: 'emerald' | 'rose'
  entries: IPEntryRow[]
  loading: boolean
  onToggle: (id: number, is_active: boolean) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onAdd: () => void
}

function IpTable({ title, color, entries, loading, onToggle, onDelete, onAdd }: IpTableProps) {
  const headerCls = color === 'emerald'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400'
  const addBtnCls = color === 'emerald'
    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
    : 'bg-rose-500 hover:bg-rose-600 text-white'

  return (
    <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h4 className={cn('text-xs font-bold uppercase tracking-wide', headerCls)}>{title}</h4>
        <button type="button" onClick={onAdd}
          className={cn('flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors', addBtnCls)}>
          <Plus className="h-3 w-3" /> Add IP
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-xs gap-1">
          <Globe className="h-6 w-6 opacity-30 mb-1" />
          No IPs added yet
        </div>
      ) : (
        <div className="divide-y divide-border">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
              <Switch
                checked={e.is_active}
                onCheckedChange={v => onToggle(e.id, v).catch(() => toast.error('Failed to update'))}
                size="sm"
                aria-label="Toggle IP"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-semibold text-foreground truncate">{e.ip_address}</p>
                <p className="text-[11px] text-muted-foreground truncate">{e.description ?? '—'}</p>
              </div>
              <button type="button"
                onClick={() => onDelete(e.id).catch(() => toast.error('Failed to remove'))}
                aria-label="Remove IP"
                className="text-muted-foreground hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main SecurityTab ───────────────────────────────────────────
export function SecurityTab() {
  const {
    whitelist, blacklist, loading,
    addWhitelist, addBlacklist,
    removeWhitelist, removeBlacklist,
    toggleWhitelist, toggleBlacklist,
  } = useIPManagement()

  const { ip: currentIP } = useIPCheck()
  const { getValue, upsert, loading: settingsLoading } = useSystemSettings()

  const [modal, setModal] = useState<{ list: 'whitelist' | 'blacklist'; prefill?: string } | null>(null)
  const [togglingRestriction, setTogglingRestriction] = useState(false)

  const restrictionEnabled = getValue('ip_restriction_enabled') === 'true'
  const currentIpInWhitelist = whitelist.some(e => e.ip_address === currentIP && e.is_active)

  async function handleAdd(list: 'whitelist' | 'blacklist', ip: string, description: string) {
    if (list === 'whitelist') {
      await addWhitelist(ip, description)
      toast.success('IP added to whitelist')
    } else {
      await addBlacklist(ip, description)
      toast.success('IP added to blacklist')
    }
  }

  async function handleToggleRestriction(enabled: boolean) {
    setTogglingRestriction(true)
    try {
      await upsert('ip_restriction_enabled', String(enabled))
      toast.success(`IP restriction ${enabled ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error('Failed to update setting')
    } finally {
      setTogglingRestriction(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* IP Restriction toggle */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">IP Access Restriction</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, only IPs in the whitelist can access this CRM.
              Blacklisted IPs are always blocked regardless of this setting.
            </p>
          </div>
        </div>
        <Switch
          checked={restrictionEnabled}
          onCheckedChange={handleToggleRestriction}
          disabled={settingsLoading || togglingRestriction}
          aria-label="Toggle IP restriction"
        />
      </div>

      {/* Current IP detection */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <Globe className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Your Current IP Address</p>
              <p className="text-sm font-mono text-muted-foreground">
                {currentIP || <span className="italic opacity-60">Detecting…</span>}
              </p>
            </div>
          </div>
          {currentIP && (
            currentIpInWhitelist ? (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> Whitelisted
              </span>
            ) : (
              <button type="button"
                onClick={() => setModal({ list: 'whitelist', prefill: currentIP })}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors">
                <Plus className="h-3 w-3" /> Add to Whitelist
              </button>
            )
          )}
        </div>
      </div>

      {/* IP tables */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <IpTable
          title="IP Whitelist"
          color="emerald"
          entries={whitelist}
          loading={loading}
          onToggle={toggleWhitelist}
          onDelete={removeWhitelist}
          onAdd={() => setModal({ list: 'whitelist' })}
        />
        <IpTable
          title="IP Blacklist"
          color="rose"
          entries={blacklist}
          loading={loading}
          onToggle={toggleBlacklist}
          onDelete={removeBlacklist}
          onAdd={() => setModal({ list: 'blacklist' })}
        />
      </div>

      {modal && (
        <AddIpModal
          listType={modal.list}
          prefillIp={modal.prefill}
          onClose={() => setModal(null)}
          onAdd={(ip, desc) => handleAdd(modal.list, ip, desc)}
        />
      )}
    </div>
  )
}
