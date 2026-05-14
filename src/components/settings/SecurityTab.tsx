import { useState } from 'react'
import { Plus, Trash2, Shield, Globe, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'

interface IpEntry {
  id: string
  ip: string
  description: string
  active: boolean
  addedAt: string
}

const MOCK_WHITELIST: IpEntry[] = [
  { id: 'w1', ip: '192.168.1.0/24', description: 'Office network', active: true, addedAt: '2025-01-10' },
  { id: 'w2', ip: '10.0.0.1',       description: 'VPN gateway',     active: true, addedAt: '2025-02-14' },
]

const MOCK_BLACKLIST: IpEntry[] = [
  { id: 'b1', ip: '203.0.113.42', description: 'Known bot',       active: true, addedAt: '2025-03-01' },
  { id: 'b2', ip: '198.51.100.5', description: 'Suspicious login', active: false, addedAt: '2025-04-20' },
]

const SIMULATED_CURRENT_IP = '203.0.113.99'

const inputCls = (err?: boolean) => cn(
  'w-full h-9 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
  err ? 'border-rose-500' : 'border-input hover:border-muted-foreground',
)

interface AddIpModalProps {
  listType: 'whitelist' | 'blacklist'
  prefillIp?: string
  onClose: () => void
  onAdd: (entry: Omit<IpEntry, 'id' | 'addedAt'>) => void
}

function AddIpModal({ listType, prefillIp = '', onClose, onAdd }: AddIpModalProps) {
  const [ip, setIp]           = useState(prefillIp)
  const [desc, setDesc]       = useState('')
  const [active, setActive]   = useState(true)
  const [ipError, setIpError] = useState('')

  function validate() {
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    if (!ip.trim()) { setIpError('IP address is required'); return false }
    if (!ipv4.test(ip.trim())) { setIpError('Enter a valid IPv4 address or CIDR block'); return false }
    return true
  }

  function handleAdd() {
    if (!validate()) return
    onAdd({ ip: ip.trim(), description: desc.trim() || '—', active })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground capitalize">
            Add to {listType === 'whitelist' ? 'Whitelist' : 'Blacklist'}
          </h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Active</span>
            <Switch checked={active} onCheckedChange={setActive} size="sm" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleAdd}
            className={cn(
              'flex-1 h-9 rounded-lg text-sm font-semibold transition-colors',
              listType === 'whitelist'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-rose-500 hover:bg-rose-600 text-white',
            )}>
            Add IP
          </button>
        </div>
      </div>
    </div>
  )
}

interface IpTableProps {
  title: string
  color: 'emerald' | 'rose'
  entries: IpEntry[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

function IpTable({ title, color, entries, onToggle, onDelete, onAdd }: IpTableProps) {
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
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-xs gap-1">
          <Globe className="h-6 w-6 opacity-30 mb-1" />
          No IPs added yet
        </div>
      ) : (
        <div className="divide-y divide-border">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
              <Switch checked={e.active} onCheckedChange={() => onToggle(e.id)} size="sm" aria-label="Toggle IP" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-semibold text-foreground truncate">{e.ip}</p>
                <p className="text-[11px] text-muted-foreground truncate">{e.description}</p>
              </div>
              <button type="button" onClick={() => onDelete(e.id)}
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

export function SecurityTab() {
  const [whitelist, setWhitelist] = useState<IpEntry[]>(MOCK_WHITELIST)
  const [blacklist, setBlacklist] = useState<IpEntry[]>(MOCK_BLACKLIST)
  const [modal, setModal] = useState<{ list: 'whitelist' | 'blacklist'; prefill?: string } | null>(null)

  function makeId() { return `ip_${Date.now()}` }
  const today = new Date().toISOString().split('T')[0]

  function addToList(list: 'whitelist' | 'blacklist', entry: Omit<IpEntry, 'id' | 'addedAt'>) {
    const newEntry: IpEntry = { ...entry, id: makeId(), addedAt: today }
    if (list === 'whitelist') {
      setWhitelist(p => [newEntry, ...p])
      toast.success('IP added to whitelist')
    } else {
      setBlacklist(p => [newEntry, ...p])
      toast.success('IP added to blacklist')
    }
  }

  function toggleEntry(list: 'whitelist' | 'blacklist', id: string) {
    const setter = list === 'whitelist' ? setWhitelist : setBlacklist
    setter(p => p.map(e => e.id === id ? { ...e, active: !e.active } : e))
  }

  function deleteEntry(list: 'whitelist' | 'blacklist', id: string) {
    const setter = list === 'whitelist' ? setWhitelist : setBlacklist
    setter(p => p.filter(e => e.id !== id))
    toast.success('IP removed')
  }

  const currentIpInWhitelist = whitelist.some(e => e.ip === SIMULATED_CURRENT_IP)

  return (
    <div className="max-w-4xl space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">IP Access Control</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Only whitelisted IP addresses can access this CRM. Blacklisted IPs are blocked immediately.
            Leave the whitelist empty to allow all IPs.
          </p>
        </div>
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
              <p className="text-sm font-mono text-muted-foreground">{SIMULATED_CURRENT_IP}</p>
            </div>
          </div>
          {currentIpInWhitelist ? (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Whitelisted
            </span>
          ) : (
            <button type="button"
              onClick={() => setModal({ list: 'whitelist', prefill: SIMULATED_CURRENT_IP })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors">
              <Plus className="h-3 w-3" /> Add to Whitelist
            </button>
          )}
        </div>
      </div>

      {/* IP tables */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <IpTable
          title="IP Whitelist"
          color="emerald"
          entries={whitelist}
          onToggle={id => toggleEntry('whitelist', id)}
          onDelete={id => deleteEntry('whitelist', id)}
          onAdd={() => setModal({ list: 'whitelist' })}
        />
        <IpTable
          title="IP Blacklist"
          color="rose"
          entries={blacklist}
          onToggle={id => toggleEntry('blacklist', id)}
          onDelete={id => deleteEntry('blacklist', id)}
          onAdd={() => setModal({ list: 'blacklist' })}
        />
      </div>

      {modal && (
        <AddIpModal
          listType={modal.list}
          prefillIp={modal.prefill}
          onClose={() => setModal(null)}
          onAdd={entry => addToList(modal.list, entry)}
        />
      )}
    </div>
  )
}
