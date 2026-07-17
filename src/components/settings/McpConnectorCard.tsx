import { useState } from 'react'
import { Bot, Link, Check, X, Loader2 } from 'lucide-react'
import { CopyButton } from './ApiTab'

type TestStatus = 'idle' | 'checking' | 'ok' | 'fail'

export function McpConnectorCard() {
  const [status, setStatus] = useState<TestStatus>('idle')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-mcp`

  async function testConnection() {
    setStatus('checking')
    try {
      const res = await fetch(url, { method: 'OPTIONS' })
      setStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setStatus('fail')
    }
  }

  const sectionHd = 'text-sm font-semibold text-foreground'
  const sectionSub = 'text-xs text-muted-foreground mt-0.5'

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <h3 className={sectionHd}>MCP Connector (claude.ai)</h3>
            <p className={sectionSub}>Let Claude read and act on your CRM data via a Custom Connector</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <code className="flex-1 text-xs font-mono text-foreground truncate">{url}</code>
          <CopyButton text={url} />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testConnection}
            disabled={status === 'checking'}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60 transition-colors"
          >
            {status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" />}
            Test Connection
          </button>

          {status === 'ok' && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Reachable
            </span>
          )}
          {status === 'fail' && (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive">
              <X className="h-3.5 w-3.5" /> Unreachable
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          Register this URL as a Custom Connector in claude.ai (Settings → Connectors), with an{' '}
          <code className="font-mono bg-muted px-1 rounded">Authorization: Bearer &lt;CRM_MCP_TOKEN&gt;</code>{' '}
          request header. Find or rotate the token in Supabase Dashboard → Edge Functions → Secrets
          — it can't be shown here since Supabase doesn't expose secret values back through any API.
        </p>
      </div>
    </div>
  )
}
