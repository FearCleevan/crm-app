# MCP Connector Settings Panel — Design Spec

## Problem

The user asked to see the `crm-mcp` remote connector's URL somewhere in the CRM app's own
Settings UI, the way most SaaS products surface integration URLs/API keys in their settings page,
instead of only knowing it from the Supabase Dashboard.

## Goal

Add a small, read-only panel to the existing Settings → API tab showing the `crm-mcp` Edge
Function's connector URL, a copy button, and a manual "Test Connection" reachability check.

## Non-goals

- **Do not display or store the `CRM_MCP_TOKEN` bearer secret anywhere in the app.** Supabase
  Edge Function Secrets cannot be read back through any API once set — there is no way for the
  CRM app to fetch the actual token value. Storing a second copy of it in the app's own database
  purely for display was considered and explicitly declined: it would mean two places holding the
  same secret that could drift out of sync on rotation, for a "SaaS convenience" that isn't worth
  that tradeoff here. The token stays exclusively in Supabase Secrets, exactly as it is today.
- No live auth check — the "Test Connection" button can only confirm the function is deployed and
  responding (`OPTIONS` request, no token needed), not that the bearer-token auth actually works.
  A real end-to-end check still requires testing through claude.ai itself.
- No new database table, no new service file, no new edge function — this is a pure frontend
  addition reading an existing env var and making one client-side fetch.

## Architecture

A new component, `src/components/settings/McpConnectorCard.tsx`, exporting a single
`McpConnectorCard` component. It is imported and rendered inside `src/components/settings/ApiTab.tsx`,
as a new section alongside the existing API Keys / Webhooks / Integrations sections, rather than
adding more inline JSX directly into that already-~660-line file — this keeps the new section's
own state (the test-connection status) isolated in its own small, independently readable file.

One small edit to `ApiTab.tsx`: its existing `CopyButton` function (currently unexported,
`ApiTab.tsx:22`) gets an `export` keyword added so `McpConnectorCard.tsx` can import and reuse it
instead of duplicating it.

## Component

```tsx
function McpConnectorCard() {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-mcp`
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')

  async function testConnection() {
    setStatus('checking')
    try {
      const res = await fetch(url, { method: 'OPTIONS' })
      setStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setStatus('fail')
    }
  }

  // Renders: section heading, the URL in a <code> block (matching the existing
  // webhook-row visual pattern: icon + <code className="font-mono truncate">),
  // CopyButton, a "Test Connection" button, a status indicator (idle/checking/✓ Reachable/✗ Unreachable),
  // and a short static instructions block pointing at Supabase Dashboard → Edge Functions → Secrets
  // (for the token) and claude.ai → Settings → Connectors (for registration).
}
```

## Data flow

The URL is derived entirely client-side from `import.meta.env.VITE_SUPABASE_URL` (already loaded
for the Supabase client elsewhere in the app) — no new env var, no hardcoded project ref. The only
network call this component makes is the one-off `OPTIONS` fetch triggered by clicking "Test
Connection"; nothing runs automatically on mount.

## Error handling

The `OPTIONS` fetch is wrapped in try/catch. Network failure, CORS rejection, and a non-2xx
response all collapse to the same "✗ Unreachable" state — this component doesn't need to
distinguish *why* it failed, only whether the function responded. There is no other I/O in this
component, so no other failure mode exists.

## Testing

No automated frontend test suite exists for this project (matches convention). Verification is
manual: run the dev server, open Settings → API, confirm the URL renders with the correct
project ref, the copy button works, and clicking "Test Connection" shows "✓ Reachable" against the
now-deployed `crm-mcp` function.
