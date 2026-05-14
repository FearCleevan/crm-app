import { useState } from 'react'
import { Eye, EyeOff, RefreshCw, Copy, Check, Plus, X, ExternalLink, Zap, Link } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MOCK_API_KEY = import.meta.env.VITE_API_KEY || ''
const MOCK_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || ''

interface Integration {
  id: string
  name: string
  logo: string
  description: string
  connected: boolean
  category: string
}

const INTEGRATIONS: Integration[] = [
  { id: 'salesforce', name: 'Salesforce',  logo: '☁️', description: 'Sync contacts, opportunities, and activities bi-directionally', connected: false, category: 'CRM' },
  { id: 'hubspot',    name: 'HubSpot',     logo: '🟠', description: 'Import/export leads and deal stages from HubSpot CRM',         connected: true,  category: 'CRM' },
  { id: 'zapier',     name: 'Zapier',      logo: '⚡', description: 'Automate workflows by connecting 5,000+ apps via Zapier',      connected: false, category: 'Automation' },
  { id: 'slack',      name: 'Slack',       logo: '💬', description: 'Receive CRM notifications and alerts in your Slack channels',  connected: true,  category: 'Communication' },
]

function ConnectModal({ integration, onClose }: { integration: Integration; onClose: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConnect() {
    if (!apiKey.trim()) { toast.error('API key is required'); return }
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    toast.success(`Connected to ${integration.name}`)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{integration.logo}</span>
            <h3 className="text-sm font-semibold text-foreground">Connect {integration.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{integration.description}</p>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">{integration.name} API Key</label>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your API key here"
            className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleConnect} disabled={saving}
            className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {saving ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ApiTab() {
  const [showKey, setShowKey]             = useState(false)
  const [apiKey, setApiKey]               = useState(MOCK_API_KEY)
  const [copied, setCopied]               = useState(false)
  const [regenerating, setRegenerating]   = useState(false)
  const [webhookUrl, setWebhookUrl]       = useState(MOCK_WEBHOOK_URL)
  const [webhookDirty, setWebhookDirty]   = useState(false)
  const [connectTarget, setConnectTarget] = useState<Integration | null>(null)
  const [integrations, setIntegrations]   = useState(INTEGRATIONS)

  const maskedKey = apiKey.slice(0, 10) + '•'.repeat(28) + apiKey.slice(-6)

  async function handleRegenerate() {
    if (!confirm('Regenerate API key? Your existing key will stop working immediately.')) return
    setRegenerating(true)
    await new Promise(r => setTimeout(r, 800))
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const newKey = 'sk_live_' + Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setApiKey(newKey)
    setShowKey(true)
    toast.success('API key regenerated — copy it now, it won\'t be shown again')
    setRegenerating(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('API key copied')
    })
  }

  function handleDisconnect(id: string) {
    setIntegrations(p => p.map(i => i.id === id ? { ...i, connected: false } : i))
    toast.success('Integration disconnected')
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* API Key */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">API Key</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Use this key to authenticate with the Brisk CRM API</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-9 rounded-lg border border-border bg-muted/30 px-3 flex items-center">
            <code className="text-xs font-mono text-foreground truncate">
              {showKey ? apiKey : maskedKey}
            </code>
          </div>
          <button type="button" onClick={() => setShowKey(v => !v)}
            aria-label={showKey ? 'Hide key' : 'Reveal key'}
            className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button type="button" onClick={handleCopy}
            aria-label="Copy key"
            className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-muted-foreground">
            Rate limit: <span className="font-semibold text-foreground">1,000 requests / hour</span>
          </p>
          <button type="button" onClick={handleRegenerate} disabled={regenerating}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-60 transition-colors">
            <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
            {regenerating ? 'Regenerating…' : 'Regenerate Key'}
          </button>
        </div>
      </div>

      {/* Webhook */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Webhook Endpoint</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Receive real-time events when records change in Brisk CRM</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Webhook URL</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input value={webhookUrl}
                onChange={e => { setWebhookUrl(e.target.value); setWebhookDirty(true) }}
                placeholder="https://your-server.com/webhook"
                className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button type="button" onClick={() => { toast.success('Webhook URL saved'); setWebhookDirty(false) }}
              disabled={!webhookDirty}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0">
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['prospect.created', 'prospect.updated', 'deal.stage_changed', 'deal.closed', 'user.invited'].map(event => (
            <span key={event} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] font-mono text-muted-foreground">
              <Zap className="h-2.5 w-2.5" />{event}
            </span>
          ))}
        </div>
      </div>

      {/* Third-party integrations */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Third-Party Connections</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Connect your CRM to external tools and services</p>
        </div>
        <div className="divide-y divide-border">
          {integrations.map(integration => (
            <div key={integration.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
              <span className="text-2xl shrink-0">{integration.logo}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{integration.name}</p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {integration.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{integration.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {integration.connected ? (
                  <>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                      Connected
                    </span>
                    <button type="button" onClick={() => handleDisconnect(integration.id)}
                      className="h-7 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConnectTarget(integration)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                    <Plus className="h-3 w-3" /> Connect
                  </button>
                )}
                <a href="#" aria-label="Docs" onClick={e => e.preventDefault()}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {connectTarget && (
        <ConnectModal integration={connectTarget} onClose={() => setConnectTarget(null)} />
      )}
    </div>
  )
}
