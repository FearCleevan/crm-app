# crm-mcp Bare-Root Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make claude.ai's Custom Connector for `crm-mcp` register successfully by exposing its OAuth discovery/JSON-RPC surface at a bare-root URL (`https://brisk-crm.vercel.app`) instead of a Supabase Edge Function path, eliminating RFC 8414/9728's well-known-URI path-insertion ambiguity.

**Architecture:** A new Vercel Edge Middleware (`crm-app/middleware.ts`) intercepts the MCP/OAuth paths and proxies them to the real `crm-mcp` Supabase function via `fetch()`, while `GET /` continues to serve the existing React SPA unchanged. `crm-mcp` itself gains a `publicBaseUrl()` helper so every URL it advertises (issuer, resource, `WWW-Authenticate`) reflects the new bare-root identity instead of its own Supabase address.

**Tech Stack:** Vercel Edge Middleware (`@vercel/functions`), Deno (crm-mcp, unchanged runtime), TypeScript, `tsx` for local middleware verification.

## Global Constraints

- The connector's public identity becomes `https://brisk-crm.vercel.app` (reused existing Vercel app domain, no new custom domain yet — spec explicitly defers that).
- `crm-mcp`'s actual serving address (`SUPABASE_URL` + `/functions/v1/crm-mcp`) does not change — only what it *advertises* in metadata changes.
- New env var `MCP_PUBLIC_URL` (Supabase Edge Function secret) drives the new advertised base URL; if unset, behavior falls back exactly to today's Supabase-URL-based output — every existing local test must keep passing unmodified.
- New env var `SUPABASE_CRM_MCP_URL` (Vercel project env var) is the middleware's proxy target — the same Supabase function URL, e.g. `https://wrtyatftfipchzrsehvl.supabase.co/functions/v1/crm-mcp`.
- Middleware must proxy `POST /` and `OPTIONS /` (JSON-RPC), plus any method on `/register`, `/authorize`, `/token`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`. `GET /` must keep serving the SPA untouched.
- Upstream 3xx redirects (the `/authorize` success case, which redirects to `https://claude.ai/api/mcp/auth_callback`) must pass through to the browser unmodified — the proxy must never follow them itself (`redirect: 'manual'` on the outbound fetch).
- No change to `ALLOWED_REDIRECT_URIS`, PKCE, HMAC signing, or any other OAuth security property — this plan is a routing/URL-shape fix only.
- Confirmed via `grep` (see spec) that no existing `src/App.tsx` route collides with any of the 5 proxied non-root paths.
- `DEPLOY_BUNDLE.ts` must always be regenerated and re-verified (`deno check` + local smoke test) whenever `oauth.ts` changes — established project convention, not new to this plan.

---

### Task 1: `publicBaseUrl()` in crm-mcp's modular OAuth source

**Files:**
- Modify: `supabase/functions/crm-mcp/oauth.ts:6-12` (add `publicBaseUrl`, update `protectedResourceMetadataUrl`)
- Modify: `supabase/functions/crm-mcp/oauth.ts:50-51` (`handleMetadata`)
- Modify: `supabase/functions/crm-mcp/oauth.ts:68-69` (`handleProtectedResourceMetadata`)
- Modify: `supabase/functions/crm-mcp/scripts/verify-http.mjs:201-215` (add fallback-shape regression assertions)

**Interfaces:**
- Produces: `publicBaseUrl(): string` (exported from `oauth.ts`) — later tasks (Task 2's bundle regeneration) mirror this exact function.
- Consumes: existing `crmMcpBaseUrl(): string` (unchanged, already exported).

- [ ] **Step 1: Add `publicBaseUrl()` right after `crmMcpBaseUrl()`, and switch `protectedResourceMetadataUrl()` to use it**

In `supabase/functions/crm-mcp/oauth.ts`, replace lines 6-12:

```typescript
export function crmMcpBaseUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mcp`
}

export function protectedResourceMetadataUrl(): string {
  return `${crmMcpBaseUrl()}/.well-known/oauth-protected-resource`
}
```

with:

```typescript
export function crmMcpBaseUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mcp`
}

export function publicBaseUrl(): string {
  return Deno.env.get('MCP_PUBLIC_URL') ?? crmMcpBaseUrl()
}

export function protectedResourceMetadataUrl(): string {
  return `${publicBaseUrl()}/.well-known/oauth-protected-resource`
}
```

- [ ] **Step 2: Switch `handleMetadata` to `publicBaseUrl()`**

In `supabase/functions/crm-mcp/oauth.ts`, in `handleMetadata` (around line 51), change:

```typescript
  const base = crmMcpBaseUrl()
```

to:

```typescript
  const base = publicBaseUrl()
```

(This is the `handleMetadata` function only — leave `handleProtectedResourceMetadata`'s identical-looking line for the next step.)

- [ ] **Step 3: Switch `handleProtectedResourceMetadata` to `publicBaseUrl()`**

In `supabase/functions/crm-mcp/oauth.ts`, in `handleProtectedResourceMetadata` (around line 69), change:

```typescript
  const base = crmMcpBaseUrl()
```

to:

```typescript
  const base = publicBaseUrl()
```

- [ ] **Step 4: Type-check**

Run: `cd supabase/functions/crm-mcp && npx deno check oauth.ts index.ts`
Expected: two `Check` lines, no errors (matches the output style already seen after the RFC 9728 fix — `Check oauth.ts` then `Check index.ts`, no error text).

- [ ] **Step 5: Add regression assertions to `verify-http.mjs` for the fallback and override behavior**

In `supabase/functions/crm-mcp/scripts/verify-http.mjs`, the existing block (lines 201-215) reads:

```javascript
  console.log('=== OAuth: GET /.well-known/oauth-protected-resource ===')
  const prmRes = await fetch(`${BASE_URL}/.well-known/oauth-protected-resource`)
  const prm = await prmRes.json()
  console.log(JSON.stringify(prm, null, 2))
  if (!prm.resource || !Array.isArray(prm.authorization_servers) || prm.authorization_servers.length === 0) {
    throw new Error('protected resource metadata missing resource or authorization_servers')
  }

  console.log('=== OAuth: GET /.well-known/oauth-authorization-server ===')
  const metaRes = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`)
  const meta = await metaRes.json()
  console.log(JSON.stringify(meta, null, 2))
  if (!meta.authorization_endpoint || !meta.token_endpoint || !meta.registration_endpoint) {
    throw new Error('metadata missing required endpoints')
  }
```

Replace it with (adds two fallback-shape assertions, since this test run's env has no `MCP_PUBLIC_URL` set):

```javascript
  console.log('=== OAuth: GET /.well-known/oauth-protected-resource ===')
  const prmRes = await fetch(`${BASE_URL}/.well-known/oauth-protected-resource`)
  const prm = await prmRes.json()
  console.log(JSON.stringify(prm, null, 2))
  if (!prm.resource || !Array.isArray(prm.authorization_servers) || prm.authorization_servers.length === 0) {
    throw new Error('protected resource metadata missing resource or authorization_servers')
  }
  if (prm.resource !== 'https://placeholder.supabase.co/functions/v1/crm-mcp') {
    throw new Error(`expected resource to fall back to the Supabase URL shape when MCP_PUBLIC_URL is unset, got ${prm.resource}`)
  }

  console.log('=== OAuth: GET /.well-known/oauth-authorization-server ===')
  const metaRes = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`)
  const meta = await metaRes.json()
  console.log(JSON.stringify(meta, null, 2))
  if (!meta.authorization_endpoint || !meta.token_endpoint || !meta.registration_endpoint) {
    throw new Error('metadata missing required endpoints')
  }
  if (meta.issuer !== 'https://placeholder.supabase.co/functions/v1/crm-mcp') {
    throw new Error(`expected issuer to fall back to the Supabase URL shape when MCP_PUBLIC_URL is unset, got ${meta.issuer}`)
  }
```

- [ ] **Step 6: Run the full HTTP verification suite**

Run (from `supabase/functions/crm-mcp/`):
```bash
netstat -ano | grep ":8000" || echo "port clear"
node scripts/verify-http.mjs
```
Expected: `ALL CHECKS PASSED` at the end, including the two new assertions passing silently (no thrown error). If port 8000 was occupied, kill the listed PID (`taskkill //PID <pid> //F` on Windows) before rerunning.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/crm-mcp/oauth.ts supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add publicBaseUrl() for advertised OAuth URLs"
```

---

### Task 2: Regenerate `DEPLOY_BUNDLE.ts`

**Files:**
- Modify: `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts:111-116` (mirror `publicBaseUrl`)
- Modify: `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts:155-156` (`handleMetadata`)
- Modify: `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts:173-174` (`handleProtectedResourceMetadata`)

**Interfaces:**
- Consumes: Task 1's `publicBaseUrl()` — this task hand-mirrors the identical function into the single-file bundle (established pattern for this file, not a new convention).

- [ ] **Step 1: Mirror the `publicBaseUrl()` addition into the bundle**

In `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts`, replace lines 111-116:

```typescript
function crmMcpBaseUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mcp`
}

function protectedResourceMetadataUrl(): string {
  return `${crmMcpBaseUrl()}/.well-known/oauth-protected-resource`
}
```

with:

```typescript
function crmMcpBaseUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mcp`
}

function publicBaseUrl(): string {
  return Deno.env.get('MCP_PUBLIC_URL') ?? crmMcpBaseUrl()
}

function protectedResourceMetadataUrl(): string {
  return `${publicBaseUrl()}/.well-known/oauth-protected-resource`
}
```

- [ ] **Step 2: Mirror the `handleMetadata` change**

In `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts`, in `async function handleMetadata` (around line 156), change:

```typescript
  const base = crmMcpBaseUrl()
```

to:

```typescript
  const base = publicBaseUrl()
```

- [ ] **Step 3: Mirror the `handleProtectedResourceMetadata` change**

In `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts`, in `async function handleProtectedResourceMetadata` (around line 174), change:

```typescript
  const base = crmMcpBaseUrl()
```

to:

```typescript
  const base = publicBaseUrl()
```

- [ ] **Step 4: Type-check the bundle**

Run: `cd supabase/functions/crm-mcp && npx deno check DEPLOY_BUNDLE.ts`
Expected: `Check DEPLOY_BUNDLE.ts`, no errors.

- [ ] **Step 5: Functional smoke test — both the fallback and the `MCP_PUBLIC_URL` override**

Run (from `supabase/functions/crm-mcp/`):
```bash
netstat -ano | grep ":8000" || echo "port clear"
(SUPABASE_URL="https://placeholder.supabase.co" SUPABASE_SERVICE_ROLE_KEY="placeholder-key" CRM_MCP_TOKEN="test-token-123" MCP_PUBLIC_URL="https://brisk-crm.vercel.app" npx deno run --allow-net --allow-env DEPLOY_BUNDLE.ts &)
sleep 3
curl -s http://localhost:8000/.well-known/oauth-protected-resource
echo ""
curl -s http://localhost:8000/.well-known/oauth-authorization-server
```
Expected: both JSON responses show `https://brisk-crm.vercel.app` (not the Supabase URL) as `resource`/`issuer`/every endpoint — confirming the override works end-to-end in the bundle. Then find and kill the test server:
```bash
netstat -ano | grep ":8000"
taskkill //PID <pid-from-above> //F
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts
git commit -m "chore(crm-mcp): regenerate DEPLOY_BUNDLE.ts with publicBaseUrl()"
```

---

### Task 3: Vercel Edge Middleware proxy

**Files:**
- Modify: `package.json` (add `@vercel/functions` dependency)
- Create: `middleware.ts` (project root, alongside `package.json`)
- Create: `scripts/verify-middleware.mjs`

**Interfaces:**
- Produces: `middleware.ts` default export `middleware(request: Request): Promise<Response>`, and `export const config = { matcher: [...] }` — Vercel's required contract for framework-agnostic Routing Middleware (confirmed against Vercel's own docs: non-Next.js projects must call `next()` from `@vercel/functions` to continue the request to normal routing; returning a plain `Response` is treated as the final response to send to the client).
- Consumes: nothing from earlier tasks — this task's only runtime dependency on `crm-mcp` is the URL shape it proxies to, which is unchanged Supabase infrastructure.

- [ ] **Step 1: Add the `@vercel/functions` dependency**

In `package.json`, insert alphabetically after line 41 (`"@tiptap/starter-kit": "^3.23.4",`) and before line 42 (`"@types/leaflet": "^1.9.21",`):

```json
    "@vercel/functions": "^3.7.5",
```

Run: `npm install`
Expected: `@vercel/functions` appears in `package-lock.json`, install completes with no errors.

- [ ] **Step 2: Write `middleware.ts`**

Create `middleware.ts` at the project root (same directory as `package.json`, `vercel.json`, `vite.config.ts`):

```typescript
import { next } from '@vercel/functions'

export const config = {
  matcher: [
    '/',
    '/register',
    '/authorize',
    '/token',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
  ],
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url)

  // The SPA owns GET / — only intercept the MCP JSON-RPC POST (and its
  // OPTIONS preflight) at the same path.
  if (url.pathname === '/' && request.method === 'GET') {
    return next()
  }

  const target = process.env.SUPABASE_CRM_MCP_URL
  if (!target) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_CRM_MCP_URL is not configured' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const headers = new Headers(request.headers)
  headers.delete('host')

  const hasBody = !['GET', 'HEAD'].includes(request.method)

  try {
    return await fetch(`${target}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Required by the Fetch spec whenever a streaming body is sent.
      ...(hasBody ? { duplex: 'half' } : {}),
      // The /authorize success path 302s to claude.ai — that redirect must
      // reach the browser untouched, never be followed by this fetch.
      redirect: 'manual',
    } as RequestInit)
  } catch {
    return new Response(
      JSON.stringify({ error: 'crm-mcp upstream unreachable' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
```

- [ ] **Step 3: Write the verification harness**

Create `scripts/verify-middleware.mjs`:

```javascript
process.env.SUPABASE_CRM_MCP_URL = 'https://placeholder.supabase.co/functions/v1/crm-mcp'

const calls = []
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init })
  if (String(url).includes('/authorize')) {
    return new Response(null, {
      status: 302,
      headers: { Location: 'https://claude.ai/api/mcp/auth_callback?code=abc' },
    })
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const { default: middleware } = await import('../middleware.ts')

async function main() {
  console.log('=== GET / passes through to the SPA (next()) ===')
  const passthrough = await middleware(new Request('https://brisk-crm.vercel.app/', { method: 'GET' }))
  if (passthrough.headers.get('x-middleware-next') !== '1') {
    throw new Error('expected GET / to call next() (x-middleware-next header missing)')
  }

  console.log('=== POST / proxies to crm-mcp root ===')
  const rpcRes = await middleware(new Request('https://brisk-crm.vercel.app/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  }))
  if (rpcRes.headers.get('x-middleware-next') === '1') {
    throw new Error('expected POST / to be proxied, not passed through')
  }
  if (calls[calls.length - 1].url !== 'https://placeholder.supabase.co/functions/v1/crm-mcp/') {
    throw new Error(`expected proxy target root, got ${calls[calls.length - 1].url}`)
  }
  if (calls[calls.length - 1].init.duplex !== 'half') {
    throw new Error('expected duplex: "half" on the proxied POST request')
  }

  console.log('=== GET /.well-known/oauth-authorization-server proxies verbatim ===')
  await middleware(new Request('https://brisk-crm.vercel.app/.well-known/oauth-authorization-server'))
  if (!calls[calls.length - 1].url.endsWith('/.well-known/oauth-authorization-server')) {
    throw new Error('expected well-known path to be proxied verbatim')
  }

  console.log('=== POST /authorize: upstream 302 redirect passes through untouched ===')
  const authRes = await middleware(new Request('https://brisk-crm.vercel.app/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=x',
  }))
  if (authRes.status !== 302 || !authRes.headers.get('location')?.includes('claude.ai')) {
    throw new Error('expected the upstream 302 redirect to pass through untouched')
  }

  console.log('=== Missing SUPABASE_CRM_MCP_URL returns 502 ===')
  delete process.env.SUPABASE_CRM_MCP_URL
  const missingEnvRes = await middleware(new Request('https://brisk-crm.vercel.app/register', { method: 'POST' }))
  if (missingEnvRes.status !== 502) throw new Error('expected 502 when SUPABASE_CRM_MCP_URL is unset')

  console.log('ALL CHECKS PASSED')
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Type-check `middleware.ts`**

`middleware.ts` lives outside `src/`, so it isn't covered by `tsconfig.app.json` (`include: ["src"]`) or `tsconfig.node.json` (`include: ["vite.config.ts"]`) — `npx tsc -b` silently skips it. Type-check it directly instead:

Run:

```bash
npx tsc --noEmit --ignoreConfig --types node --target es2022 --lib es2022,dom --module esnext --moduleResolution bundler middleware.ts
```

Expected: no output, exit code 0 (`--lib dom` provides `Request`/`Response`/`Headers`/`fetch`, which Vercel's Edge Runtime also implements).

- [ ] **Step 5: Run the verification harness**

Run: `npx tsx scripts/verify-middleware.mjs`
Expected: `ALL CHECKS PASSED` at the end, with no thrown errors from any of the five checks. (This step exercises the runtime behavior; it transpiles but does not type-check, which is why Step 4 exists separately.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json middleware.ts scripts/verify-middleware.mjs
git commit -m "feat: add Vercel Edge Middleware to proxy crm-mcp at the bare domain root"
```

---

### Task 4: Settings UI, env docs, and README updates

**Files:**
- Modify: `src/components/settings/McpConnectorCard.tsx` (whole file — small, shown in full below)
- Modify: `.env.example`
- Modify: `supabase/functions/crm-mcp/README.md:42-60`

**Interfaces:**
- Consumes: `import.meta.env.VITE_MCP_PUBLIC_URL` (new, optional Vite env var) — falls back to `window.location.origin`, which is always correct since the app and the proxy now share one domain.

- [ ] **Step 1: Update `McpConnectorCard.tsx` to display the bare-root URL and correct footer copy**

Replace the full contents of `src/components/settings/McpConnectorCard.tsx`:

```tsx
import { useState } from 'react'
import { Bot, Link, Check, X, Loader2 } from 'lucide-react'
import { CopyButton } from './ApiTab'

type TestStatus = 'idle' | 'checking' | 'ok' | 'fail'

export function McpConnectorCard() {
  const [status, setStatus] = useState<TestStatus>('idle')

  const url = import.meta.env.VITE_MCP_PUBLIC_URL ?? window.location.origin

  async function testConnection() {
    setStatus('checking')
    const timeout = AbortSignal.timeout(8000)
    try {
      const res = await fetch(url, { method: 'OPTIONS', signal: timeout })
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
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">
              <Check className="h-3.5 w-3.5" /> Reachable
            </span>
          )}
          {status === 'fail' && (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive" role="status">
              <X className="h-3.5 w-3.5" /> Unreachable — is the connector proxy deployed yet?
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          Register this URL as a Custom Connector in claude.ai (Settings → Connectors). Leave the
          OAuth Client ID / Secret fields blank — claude.ai discovers the OAuth endpoints
          automatically and will prompt you for the <code className="font-mono bg-muted px-1 rounded">CRM_MCP_TOKEN</code>{' '}
          in a browser tab. Find or rotate that token in Supabase Dashboard → Edge Functions →
          Secrets — it can't be shown here since Supabase doesn't expose secret values back through
          any API.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Document the new optional env var**

In `.env.example`, append after the existing two lines:

```
# Optional — the bare-root URL registered as the claude.ai Custom Connector.
# Falls back to window.location.origin if unset (correct for the default setup).
VITE_MCP_PUBLIC_URL=https://brisk-crm.vercel.app
```

- [ ] **Step 3: Update the README's "Register in claude.ai" section**

In `supabase/functions/crm-mcp/README.md`, replace lines 42-60:

```markdown
## Register in claude.ai

1. Redeploy `crm-mcp` with the new files (`oauth.ts`, updated `index.ts`, `auth.ts`, `jsonRpc.ts`) via
   the Supabase Dashboard — same process as before (see "Deploy" above), just with the additional
   OAuth files included.
2. claude.ai → Settings → Connectors → **Add custom connector**.
3. Paste the function URL from the "Deploy" section above: `https://<project-ref>.supabase.co/functions/v1/crm-mcp`.
4. Leave the OAuth Client ID / Client Secret fields blank — claude.ai will discover the OAuth
   endpoints automatically and register itself.
5. Click Add. A browser tab/popup should open asking for your `CRM_MCP_TOKEN` — enter it there
   (not in claude.ai's own UI). On success you'll be redirected back and the connector will show
   as connected.
6. Ask Claude to search for a real prospect to confirm the connection works end to end.

**If this still fails at the "couldn't register" / discovery step:** Supabase Edge Functions
cannot serve anything at the bare domain root, only under `/functions/v1/crm-mcp/...` — if
claude.ai's discovery specifically requires the metadata at the domain root, this is a real
platform limitation requiring a different hosting approach (e.g. a custom domain), not a
prompt/config fix. Report back what specifically fails rather than assuming it's a code bug.
```

with:

```markdown
## Register in claude.ai

Registration goes through a Vercel Edge Middleware proxy (`crm-app/middleware.ts`) that fronts
this function at the bare root of the CRM app's own domain — required because RFC 8414/9728's
well-known-URI discovery algorithm inserts the well-known segment between host and path for any
issuer/resource URL that has a path component, and Supabase's platform routing only ever forwards
requests under `/functions/v1/crm-mcp/...` to this function. A bare-root URL sidesteps that
ambiguity entirely.

1. Redeploy `crm-mcp` via the Supabase Dashboard as usual (see "Deploy" above), and set the new
   `MCP_PUBLIC_URL` secret (Edge Functions → Secrets) to the CRM app's own domain, e.g.
   `https://brisk-crm.vercel.app`.
2. In the Vercel project's environment variables, set `SUPABASE_CRM_MCP_URL` to this function's
   real address, e.g. `https://<project-ref>.supabase.co/functions/v1/crm-mcp`, and redeploy the
   `crm-app` Vercel project so `middleware.ts` picks it up.
3. claude.ai → Settings → Connectors → **Add custom connector**.
4. Paste the CRM app's own bare-root URL (shown in Settings → API Integration → MCP Connector in
   the app itself), e.g. `https://brisk-crm.vercel.app` — not the Supabase function URL.
5. Leave the OAuth Client ID / Client Secret fields blank — claude.ai will discover the OAuth
   endpoints automatically and register itself.
6. Click Add. A browser tab/popup should open asking for your `CRM_MCP_TOKEN` — enter it there
   (not in claude.ai's own UI). On success you'll be redirected back and the connector will show
   as connected.
7. Ask Claude to search for a real prospect to confirm the connection works end to end.
```

- [ ] **Step 4: Type-check the frontend**

Run: `npx tsc -b`
Expected: no errors (matches project convention — `oauth.ts`/Deno files are checked separately via `deno check`, not by this command; this only covers `src/`).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/McpConnectorCard.tsx .env.example supabase/functions/crm-mcp/README.md
git commit -m "docs+ui: point the connector URL at the new bare-root proxy"
```
