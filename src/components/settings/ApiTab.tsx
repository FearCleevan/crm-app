import { useState, useEffect } from 'react'
import {
  Copy, Check, Plus, X, Trash2, RefreshCw, Eye, EyeOff,
  Zap, Link, Key, Webhook, PlugZap, AlertTriangle, Clock,
} from 'lucide-react'
import airtableLogo   from '@/assets/AirTable.png'
import mightcallLogo  from '@/assets/MightyCall.png'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { apiKeysService, type ApiKeyRow } from '@/services/apiKeys.service'
import { integrationsService, type IntegrationRow, type IntegrationProvider } from '@/services/integrations.service'
import { webhooksService, type WebhookRow, WEBHOOK_EVENTS } from '@/services/webhooks.service'
import { supabase } from '@/lib/supabase'
import { McpConnectorCard } from './McpConnectorCard'

// ── helpers ────────────────────────────────────────────────────
function fmt(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'lg' }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const cls = size === 'lg'
    ? 'h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center gap-1.5 transition-colors'
    : 'h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border'
  return (
    <button type="button" onClick={copy} title="Copy" className={cls}>
      {copied
        ? <Check className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        : <Copy className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}
      {size === 'lg' && (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}

// ── Reveal Modal (key or secret shown once) ────────────────────
function RevealModal({ title, value, note, onClose }: { title: string; value: string; note: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{note}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-9 rounded-lg border border-border bg-muted/30 px-3 flex items-center min-w-0">
            <code className="text-xs font-mono text-foreground truncate">
              {visible ? value : '•'.repeat(Math.min(value.length, 48))}
            </code>
          </div>
          <button type="button" onClick={() => setVisible(v => !v)}
            title={visible ? 'Hide' : 'Show'}
            className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <CopyButton text={value} />
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Done — I've saved it
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Generate Key Modal ─────────────────────────────────────────
function GenerateKeyModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: (key: string, row: ApiKeyRow) => void }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !user) return
    setSaving(true)
    try {
      const { key, row } = await apiKeysService.generateKey(user.id, name.trim())
      onGenerated(key, row)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate key')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Generate API Key</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Key Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. My Automation Script"
              autoFocus
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Webhook Modal ──────────────────────────────────────────
function AddWebhookModal({ onClose, onCreated }: { onClose: () => void; onCreated: (row: WebhookRow, secret: string) => void }) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleEvent(ev: string) {
    setSelectedEvents(prev => {
      const next = new Set(prev)
      next.has(ev) ? next.delete(ev) : next.add(ev)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!url.trim() || selectedEvents.size === 0 || !user) return
    setSaving(true)
    try {
      const { row, secret } = await webhooksService.create(user.id, url.trim(), [...selectedEvents] as never)
      onCreated(row, secret)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add webhook')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Add Webhook Endpoint</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Endpoint URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              autoFocus
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Subscribe to Events</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {WEBHOOK_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={selectedEvents.has(ev)} onChange={() => toggleEvent(ev)}
                    className="h-3.5 w-3.5 rounded accent-primary" />
                  <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors truncate">{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" disabled={!url.trim() || selectedEvents.size === 0 || saving}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? 'Creating…' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Connect Integration Modal ──────────────────────────────────
const PROVIDER_META: Record<IntegrationProvider, { label: string; logo: string; fields: { key: string; label: string; placeholder: string; hint?: string }[] }> = {
  airtable: {
    label: 'AirTable',
    logo: airtableLogo,
    fields: [
      { key: 'api_key',   label: 'Personal Access Token', placeholder: 'patXXXXXX.YYYYYYYY', hint: 'Found in AirTable → Account → Developer Hub → Personal access tokens' },
      { key: 'base_id',   label: 'Base ID',               placeholder: 'appXXXXXXXXXXXXXX',  hint: 'Found in the AirTable URL: airtable.com/appXXX/...' },
      { key: 'table_name', label: 'Table Name',           placeholder: 'Prospects',            hint: 'Name of the table to sync prospects into' },
    ],
  },
  mightcall: {
    label: 'MightCall',
    logo: mightcallLogo,
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Paste your MightCall API key', hint: 'Found in MightCall → Settings → Integrations → API' },
    ],
  },
}

function ConnectIntegrationModal({ provider, onClose, onConnected }: { provider: IntegrationProvider; onClose: () => void; onConnected: (row: IntegrationRow) => void }) {
  const { user } = useAuth()
  const meta = PROVIDER_META[provider]
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const missing = meta.fields.find(f => !fields[f.key]?.trim())
    if (missing || !user) return
    setSaving(true)
    try {
      const row = await integrationsService.connect(user.id, provider, meta.label, fields)
      onConnected(row)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
      setSaving(false)
    }
  }

  const allFilled = meta.fields.every(f => fields[f.key]?.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={meta.logo} alt={meta.label} className="h-7 w-7 rounded object-contain" />
            <h3 className="text-sm font-bold text-foreground">Connect {meta.label}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {meta.fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{f.label}</label>
              <input value={fields[f.key] ?? ''}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" disabled={!allFilled || saving}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ApiTab ────────────────────────────────────────────────
export function ApiTab() {
  const { user } = useAuth()

  // API Keys
  const [apiKeys,         setApiKeys]         = useState<ApiKeyRow[]>([])
  const [keysLoading,     setKeysLoading]      = useState(true)
  const [showGenKey,      setShowGenKey]       = useState(false)
  const [revealKey,       setRevealKey]        = useState<string | null>(null)

  // Webhooks
  const [webhooks,        setWebhooks]         = useState<WebhookRow[]>([])
  const [webhooksLoading, setWebhooksLoading]  = useState(true)
  const [showAddWebhook,  setShowAddWebhook]   = useState(false)
  const [revealSecret,    setRevealSecret]     = useState<string | null>(null)

  // Integrations
  const [integrations,    setIntegrations]     = useState<IntegrationRow[]>([])
  const [intLoading,      setIntLoading]       = useState(true)
  const [connectTarget,   setConnectTarget]    = useState<IntegrationProvider | null>(null)
  const [syncing,         setSyncing]          = useState<Record<string, boolean>>({})

  const userId = user?.id

  // Load all three on mount
  useEffect(() => {
    if (!userId) return
    apiKeysService.listKeys(userId).then(setApiKeys).catch(() => {}).finally(() => setKeysLoading(false))
    webhooksService.getAll(userId).then(setWebhooks).catch(() => {}).finally(() => setWebhooksLoading(false))
    integrationsService.getAll(userId).then(setIntegrations).catch(() => {}).finally(() => setIntLoading(false))
  }, [userId])

  // API key actions
  async function handleRevokeKey(id: string) {
    if (!confirm('Revoke this API key? Any scripts using it will stop working.')) return
    try {
      await apiKeysService.revokeKey(id)
      setApiKeys(prev => prev.filter(k => k.id !== id))
      toast.success('API key revoked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key')
    }
  }

  // Webhook actions
  async function handleToggleWebhook(id: string, active: boolean) {
    try {
      await webhooksService.update(id, { active: !active })
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !active } : w))
    } catch {
      toast.error('Failed to update webhook')
    }
  }

  async function handleRemoveWebhook(id: string) {
    if (!confirm('Delete this webhook endpoint?')) return
    try {
      await webhooksService.remove(id)
      setWebhooks(prev => prev.filter(w => w.id !== id))
      toast.success('Webhook removed')
    } catch {
      toast.error('Failed to remove webhook')
    }
  }

  // Integration actions
  async function handleDisconnect(id: string, provider: string) {
    if (!confirm(`Disconnect ${PROVIDER_META[provider as IntegrationProvider]?.label ?? provider}?`)) return
    try {
      await integrationsService.disconnect(id)
      setIntegrations(prev => prev.filter(i => i.id !== id))
      toast.success('Integration disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  async function handleSync(integration: IntegrationRow) {
    setSyncing(prev => ({ ...prev, [integration.id]: true }))
    try {
      const fnName = integration.provider === 'airtable' ? 'airtable-sync' : 'mightcall-sync'
      const { error } = await supabase.functions.invoke(fnName)
      if (error) throw new Error(error.message)
      await integrationsService.updateLastSynced(integration.id)
      setIntegrations(prev => prev.map(i => i.id === integration.id
        ? { ...i, last_synced_at: new Date().toISOString() } : i))
      toast.success(`${PROVIDER_META[integration.provider]?.label} synced successfully`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(prev => ({ ...prev, [integration.id]: false }))
    }
  }

  const sectionHd = 'text-sm font-semibold text-foreground'
  const sectionSub = 'text-xs text-muted-foreground mt-0.5'

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── API Keys ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
              <Key className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <h3 className={sectionHd}>API Keys</h3>
              <p className={sectionSub}>Allow external scripts to read Paul CRM data</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowGenKey(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="h-3.5 w-3.5" /> Generate Key
          </button>
        </div>

        {keysLoading ? (
          <div className="px-5 py-6 space-y-2">
            {[1,2].map(i => <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />)}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No API keys yet. Generate one to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{k.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-[11px] font-mono text-muted-foreground">{k.key_prefix}••••••••••••••••••••••••••••••••••••••••••••</code>
                  </div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-[10px] text-muted-foreground">Created</p>
                  <p className="text-xs text-foreground">{fmt(k.created_at)}</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-[10px] text-muted-foreground">Last used</p>
                  <p className="text-xs text-foreground">{fmt(k.last_used_at)}</p>
                </div>
                <button type="button" onClick={() => handleRevokeKey(k.id)} title="Revoke key"
                  className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-[11px] text-muted-foreground">
            Use header <code className="font-mono bg-muted px-1 rounded">X-API-Key: sk_live_...</code> when calling
            <code className="font-mono bg-muted px-1 rounded ml-1">/functions/v1/crm-api</code>
          </p>
        </div>
      </div>

      {/* ── Webhooks ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <Webhook className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h3 className={sectionHd}>Webhook Endpoints</h3>
              <p className={sectionSub}>Receive real-time CRM events at your server</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowAddWebhook(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0">
            <Plus className="h-3.5 w-3.5" /> Add Endpoint
          </button>
        </div>

        {webhooksLoading ? (
          <div className="px-5 py-6 space-y-2">
            <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No webhook endpoints configured.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {webhooks.map(w => (
              <div key={w.id} className="px-5 py-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <code className="text-xs font-mono text-foreground truncate">{w.url}</code>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button"
                      onClick={() => handleToggleWebhook(w.id, w.active)}
                      title={w.active ? 'Pause webhook' : 'Activate webhook'}
                      className={cn('h-6 px-2 rounded text-[10px] font-semibold transition-colors border',
                        w.active
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                          : 'bg-muted text-muted-foreground border-border'
                      )}>
                      {w.active ? 'Active' : 'Paused'}
                    </button>
                    <button type="button" onClick={() => handleRemoveWebhook(w.id)} title="Delete webhook"
                      className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {w.events.map(ev => (
                    <span key={ev} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                      <Zap className="h-2.5 w-2.5" />{ev}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Integrations ───────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center">
              <PlugZap className="h-4 w-4 text-sky-500" />
            </div>
            <div>
              <h3 className={sectionHd}>Third-Party Integrations</h3>
              <p className={sectionSub}>Connect Paul CRM to your existing tools</p>
            </div>
          </div>
        </div>

        {intLoading ? (
          <div className="p-5 space-y-3">
            {[1,2].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(Object.keys(PROVIDER_META) as IntegrationProvider[]).map(provider => {
              const meta = PROVIDER_META[provider]
              const integration = integrations.find(i => i.provider === provider)
              const isConnected = !!integration
              const isSyncing = integration ? !!syncing[integration.id] : false

              return (
                <div key={provider} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <img src={meta.logo} alt={meta.label} className="h-9 w-9 rounded-lg object-contain shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    {isConnected && integration?.last_synced_at && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> Last synced {fmt(integration.last_synced_at)}
                      </p>
                    )}
                    {!isConnected && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {provider === 'airtable' ? 'Sync prospects to an AirTable base' : 'Import call logs as CRM activities'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConnected ? (
                      <>
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> Connected
                        </span>
                        <button type="button" onClick={() => handleSync(integration!)} disabled={isSyncing}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60 transition-colors">
                          <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
                          {isSyncing ? 'Syncing…' : 'Sync Now'}
                        </button>
                        <button type="button" onClick={() => handleDisconnect(integration!.id, provider)}
                          className="h-7 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConnectTarget(provider)}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                        <Plus className="h-3 w-3" /> Connect
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MCP Connector ──────────────────────────────────── */}
      <McpConnectorCard />

      {/* ── Modals ─────────────────────────────────────────── */}
      {showGenKey && (
        <GenerateKeyModal
          onClose={() => setShowGenKey(false)}
          onGenerated={(key, row) => {
            setApiKeys(prev => [row, ...prev])
            setShowGenKey(false)
            setRevealKey(key)
          }}
        />
      )}

      {revealKey && (
        <RevealModal
          title="Your new API key"
          value={revealKey}
          note="Copy this key now. It won't be shown again after you close this dialog."
          onClose={() => setRevealKey(null)}
        />
      )}

      {showAddWebhook && (
        <AddWebhookModal
          onClose={() => setShowAddWebhook(false)}
          onCreated={(row, secret) => {
            setWebhooks(prev => [row, ...prev])
            setShowAddWebhook(false)
            setRevealSecret(secret)
          }}
        />
      )}

      {revealSecret && (
        <RevealModal
          title="Webhook signing secret"
          value={revealSecret}
          note="Store this secret securely. Use it to verify the X-Paul-Signature header on incoming events."
          onClose={() => setRevealSecret(null)}
        />
      )}

      {connectTarget && (
        <ConnectIntegrationModal
          provider={connectTarget}
          onClose={() => setConnectTarget(null)}
          onConnected={row => {
            setIntegrations(prev => {
              const filtered = prev.filter(i => i.provider !== row.provider)
              return [row, ...filtered]
            })
            setConnectTarget(null)
            toast.success(`${PROVIDER_META[row.provider]?.label} connected`)
          }}
        />
      )}
    </div>
  )
}
