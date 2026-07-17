# crm-mcp Minimal OAuth 2.1 Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal, fully stateless OAuth 2.1 authorization-server layer to the existing `crm-mcp` edge function, so claude.ai's Custom Connector flow (which requires OAuth and attempts Dynamic Client Registration on connect) can actually register and authenticate against it.

**Architecture:** A new `oauth.ts` module implementing 4 endpoints (metadata, register, authorize, token) plus a path-based router added to `index.ts` ahead of the existing JSON-RPC logic. Authorization codes are self-signed (HMAC-SHA256 using `CRM_MCP_TOKEN` as the key) rather than stored — no new database table.

**Tech Stack:** Deno's native Web Crypto API (`crypto.subtle`), no new dependencies.

## Global Constraints

- No new Supabase table, no persisted client registrations, no persisted authorization codes (spec non-goal).
- No refresh token — the access token returned is `CRM_MCP_TOKEN` itself, which doesn't expire (spec goal).
- The existing `/` JSON-RPC endpoint and `auth.ts`'s `checkAuth` are not modified in behavior — only `auth.ts`'s private `timingSafeEqual` helper gets exported for reuse.
- `redirect_uri` must be validated against exactly one allowed value: `https://claude.ai/api/mcp/auth_callback` (spec: claude.ai's known, fixed callback URL).
- Authorization codes expire ~5 minutes after issuance.
- **Known residual risk, not resolvable before real testing:** Supabase Edge Functions can only serve paths under `/functions/v1/crm-mcp/...` — there is no way to serve anything at the bare domain root. Some MCP clients are documented to check the domain root for `/.well-known/oauth-authorization-server` instead of the path-correct location. This plan serves the metadata at the only path Supabase makes possible; the final task's real end-to-end registration in claude.ai is the actual test of whether this works, not a guarantee from spec compliance alone.
- No automated test suite (matches project convention). Verification is real HTTP calls via `scripts/verify-http.mjs`, run locally with a test `CRM_MCP_TOKEN`, exercising the full OAuth loop end-to-end before ever touching real claude.ai.

---

## File Structure

```
crm-app/supabase/functions/crm-mcp/
  auth.ts                — MODIFY: export timingSafeEqual
  oauth.ts                — CREATE: metadata, register, authorize, token handlers + code sign/verify helpers
  index.ts                — MODIFY: add path router before existing JSON-RPC logic
  scripts/verify-http.mjs — MODIFY: add full OAuth-loop test
  README.md                — MODIFY: update claude.ai registration instructions
```

---

### Task 1: `timingSafeEqual` export, base64url/HMAC helpers, metadata + register endpoints

**Files:**
- Modify: `crm-app/supabase/functions/crm-mcp/auth.ts`
- Create: `crm-app/supabase/functions/crm-mcp/oauth.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/index.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs`

**Interfaces:**
- Consumes: nothing from other tasks yet.
- Produces: `timingSafeEqual(a: string, b: string): Promise<boolean>` (exported from `auth.ts`, used by `oauth.ts` in Tasks 2-3). `handleMetadata(req: Request): Promise<Response>` and `handleRegister(req: Request): Promise<Response>` (exported from `oauth.ts`, used by `index.ts`'s router). Also produces (internal to `oauth.ts`, used by Tasks 2-3): `base64urlEncode`, `base64urlEncodeString`, `base64urlDecodeToString`, `hmacSign`, `sha256Base64url`, `ALLOWED_REDIRECT_URIS`.

- [ ] **Step 1: Export `timingSafeEqual` in `auth.ts`**

Change:
```typescript
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
```
to:
```typescript
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
```

- [ ] **Step 2: Write `oauth.ts`**

```typescript
import { CORS } from './jsonRpc.ts'
import { timingSafeEqual } from './auth.ts'

export const ALLOWED_REDIRECT_URIS = ['https://claude.ai/api/mcp/auth_callback']

function crmMcpBaseUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mcp`
}

export function base64urlEncode(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlEncodeString(s: string): string {
  return base64urlEncode(new TextEncoder().encode(s))
}

export function base64urlDecodeToString(s: string): string {
  const pad = (4 - (s.length % 4)) % 4
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return base64urlEncode(new Uint8Array(sig))
}

export async function sha256Base64url(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return base64urlEncode(new Uint8Array(hash))
}

export async function handleMetadata(_req: Request): Promise<Response> {
  const base = crmMcpBaseUrl()
  const body = {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export async function handleRegister(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const clientId = crypto.randomUUID()
  return new Response(
    JSON.stringify({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris ?? [],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    }),
    { status: 201, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}
```

- [ ] **Step 3: Update `CORS` in `jsonRpc.ts` to allow `GET`**

Change:
```typescript
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
```
to:
```typescript
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
```

- [ ] **Step 4: Add the router in `index.ts`**

Add the import near the top (after the existing imports):
```typescript
import { handleMetadata, handleRegister } from './oauth.ts'
```

Insert this block immediately after the `if (req.method === 'OPTIONS') ...` line and before the existing `if (req.method !== 'POST') return new Response('Method Not Allowed', ...)` line:
```typescript
  const pathname = new URL(req.url).pathname

  if (req.method === 'GET' && pathname.endsWith('/.well-known/oauth-authorization-server')) {
    return handleMetadata(req)
  }
  if (req.method === 'POST' && pathname.endsWith('/register')) {
    return handleRegister(req)
  }
```

- [ ] **Step 5: Extend `scripts/verify-http.mjs`**

Add this to `main()`, after the existing checks and before `console.log('ALL CHECKS PASSED')`:
```javascript
  console.log('=== OAuth: GET /.well-known/oauth-authorization-server ===')
  const metaRes = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`)
  const meta = await metaRes.json()
  console.log(JSON.stringify(meta, null, 2))
  if (!meta.authorization_endpoint || !meta.token_endpoint || !meta.registration_endpoint) {
    throw new Error('metadata missing required endpoints')
  }

  console.log('=== OAuth: POST /register ===')
  const regRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] }),
  })
  const reg = await regRes.json()
  console.log(JSON.stringify(reg, null, 2))
  if (!reg.client_id) throw new Error('register did not return a client_id')
```

- [ ] **Step 6: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, plus the metadata endpoint returns all three required endpoint URLs and `/register` returns a `client_id`. Ends with `ALL CHECKS PASSED`.

- [ ] **Step 7: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/auth.ts crm-app/supabase/functions/crm-mcp/oauth.ts crm-app/supabase/functions/crm-mcp/jsonRpc.ts crm-app/supabase/functions/crm-mcp/index.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add OAuth metadata and DCR register endpoints"
```

---

### Task 2: `/authorize` endpoint (the safety-critical guard)

**Files:**
- Modify: `crm-app/supabase/functions/crm-mcp/oauth.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/index.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs`

**Interfaces:**
- Consumes: `timingSafeEqual` from `../auth.ts` (Task 1), `ALLOWED_REDIRECT_URIS`, `base64urlEncodeString`, `hmacSign` from `./oauth.ts` (Task 1, same file).
- Produces: `handleAuthorizeGet(req: Request): Promise<Response>`, `handleAuthorizePost(req: Request): Promise<Response>` (used by `index.ts`'s router and by Task 3's full-loop test). Also produces `signAuthCode(payload: { redirect_uri: string; code_challenge: string; exp: number }, secret: string): Promise<string>`, used by this task's own `handleAuthorizePost` and referenced by Task 3's `verifyAuthCode` (same file, same module — no cross-file interface needed, but the shape matters for Task 3 to implement the inverse function correctly).

This is the tool's actual access-control gate — the token check here is what replaces the bearer-token-in-header approach that turned out not to work.

- [ ] **Step 1: Add to `oauth.ts`**

```typescript
function renderAuthorizeForm(params: {
  redirectUri: string
  clientId: string
  codeChallenge: string
  state: string
  error?: string
}): Response {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Authorize Brisk CRM connector</title></head>
<body style="font-family: sans-serif; max-width: 420px; margin: 60px auto;">
  <h2>Authorize Brisk CRM connector</h2>
  <p>Enter your CRM_MCP_TOKEN to allow this connector to access your CRM.</p>
  ${params.error ? `<p style="color:#c00">${params.error}</p>` : ''}
  <form method="POST">
    <input type="hidden" name="redirect_uri" value="${params.redirectUri}" />
    <input type="hidden" name="client_id" value="${params.clientId}" />
    <input type="hidden" name="code_challenge" value="${params.codeChallenge}" />
    <input type="hidden" name="state" value="${params.state}" />
    <input type="password" name="token" placeholder="CRM_MCP_TOKEN"
      style="width:100%;padding:8px;margin:12px 0;box-sizing:border-box;" autofocus />
    <button type="submit" style="padding:8px 16px;">Authorize</button>
  </form>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function handleAuthorizeGet(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  const clientId = url.searchParams.get('client_id') ?? ''
  const codeChallenge = url.searchParams.get('code_challenge') ?? ''
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? ''
  const state = url.searchParams.get('state') ?? ''

  if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400, headers: CORS })
  }
  if (codeChallengeMethod !== 'S256' || !codeChallenge) {
    return new Response('PKCE code_challenge (S256) is required', { status: 400, headers: CORS })
  }

  return renderAuthorizeForm({ redirectUri, clientId, codeChallenge, state })
}

export async function signAuthCode(
  payload: { redirect_uri: string; code_challenge: string; exp: number },
  secret: string,
): Promise<string> {
  const payloadB64 = base64urlEncodeString(JSON.stringify(payload))
  const signature = await hmacSign(payloadB64, secret)
  return `${payloadB64}.${signature}`
}

export async function handleAuthorizePost(req: Request): Promise<Response> {
  const form = await req.formData()
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const clientId = String(form.get('client_id') ?? '')
  const codeChallenge = String(form.get('code_challenge') ?? '')
  const state = String(form.get('state') ?? '')
  const token = String(form.get('token') ?? '')

  if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400, headers: CORS })
  }

  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected || !(await timingSafeEqual(token, expected))) {
    return renderAuthorizeForm({
      redirectUri, clientId, codeChallenge, state,
      error: 'Incorrect token — try again.',
    })
  }

  const code = await signAuthCode(
    { redirect_uri: redirectUri, code_challenge: codeChallenge, exp: Date.now() + 5 * 60_000 },
    expected,
  )

  const redirectUrl = new URL(redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (state) redirectUrl.searchParams.set('state', state)

  return new Response(null, { status: 302, headers: { ...CORS, Location: redirectUrl.toString() } })
}
```

- [ ] **Step 2: Add the import and router entries in `index.ts`**

Change the import line from Task 1:
```typescript
import { handleMetadata, handleRegister } from './oauth.ts'
```
to:
```typescript
import { handleMetadata, handleRegister, handleAuthorizeGet, handleAuthorizePost } from './oauth.ts'
```

Add to the router block (after the `/register` check, before the `Method Not Allowed` fallback):
```typescript
  if (req.method === 'GET' && pathname.endsWith('/authorize')) {
    return handleAuthorizeGet(req)
  }
  if (req.method === 'POST' && pathname.endsWith('/authorize')) {
    return handleAuthorizePost(req)
  }
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

Add this after the `/register` check, before `console.log('ALL CHECKS PASSED')`:
```javascript
  console.log('=== OAuth: GET /authorize with bad redirect_uri (expect 400) ===')
  const badRedirect = await fetch(
    `${BASE_URL}/authorize?redirect_uri=https://evil.example.com/cb&code_challenge=x&code_challenge_method=S256`,
  )
  console.log('status:', badRedirect.status)
  if (badRedirect.status !== 400) throw new Error('expected 400 for bad redirect_uri')

  const REAL_REDIRECT = 'https://claude.ai/api/mcp/auth_callback'
  const CODE_CHALLENGE = 'test-challenge-value'

  console.log('=== OAuth: POST /authorize with WRONG token (expect no redirect) ===')
  const wrongTokenRes = await fetch(`${BASE_URL}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      redirect_uri: REAL_REDIRECT,
      client_id: 'test-client',
      code_challenge: CODE_CHALLENGE,
      state: 'test-state',
      token: 'wrong-token-value',
    }),
    redirect: 'manual',
  })
  console.log('status:', wrongTokenRes.status)
  if (wrongTokenRes.status === 302) throw new Error('wrong token should not produce a redirect')

  console.log('=== OAuth: POST /authorize with CORRECT token (expect 302 redirect with code) ===')
  const rightTokenRes = await fetch(`${BASE_URL}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      redirect_uri: REAL_REDIRECT,
      client_id: 'test-client',
      code_challenge: CODE_CHALLENGE,
      state: 'test-state',
      token: TEST_TOKEN,
    }),
    redirect: 'manual',
  })
  console.log('status:', rightTokenRes.status)
  const location = rightTokenRes.headers.get('location')
  console.log('location:', location)
  if (rightTokenRes.status !== 302 || !location || !location.includes('code=')) {
    throw new Error('expected a 302 redirect containing a code')
  }
```

Note: `TEST_TOKEN` is the same constant already defined at the top of this script (used for the `Authorization` header in earlier checks) — reuse it, do not redefine it.

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, plus: bad `redirect_uri` returns 400; wrong token does not redirect; correct token produces a 302 with a `code` parameter in the `Location` header. Ends with `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/oauth.ts crm-app/supabase/functions/crm-mcp/index.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add guarded /authorize endpoint (token-gated auth code issuance)"
```

---

### Task 3: `/token` endpoint + full-loop verification

**Files:**
- Modify: `crm-app/supabase/functions/crm-mcp/oauth.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/index.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs`

**Interfaces:**
- Consumes: `timingSafeEqual` from `../auth.ts`, `base64urlDecodeToString`, `hmacSign`, `sha256Base64url` from `./oauth.ts` (Task 1, same file), `signAuthCode`'s payload shape `{ redirect_uri: string; code_challenge: string; exp: number }` (Task 2, same file — this task implements the inverse, `verifyAuthCode`, which must decode to exactly that shape).
- Produces: `handleToken(req: Request): Promise<Response>`, used by `index.ts`'s router.

This is the task that proves the whole OAuth loop actually works end-to-end, locally, before ever touching real claude.ai.

- [ ] **Step 1: Add to `oauth.ts`**

```typescript
async function verifyAuthCode(
  code: string,
  secret: string,
): Promise<{ redirect_uri: string; code_challenge: string; exp: number } | null> {
  const parts = code.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, signature] = parts

  const expectedSig = await hmacSign(payloadB64, secret)
  if (!(await timingSafeEqual(signature, expectedSig))) return null

  try {
    const payload = JSON.parse(base64urlDecodeToString(payloadB64))
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
    if (typeof payload.redirect_uri !== 'string' || typeof payload.code_challenge !== 'string') return null
    return payload
  } catch {
    return null
  }
}

function oauthError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export async function handleToken(req: Request): Promise<Response> {
  const contentType = req.headers.get('Content-Type') ?? ''
  let params: URLSearchParams
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    params = new URLSearchParams(body)
  } else {
    params = new URLSearchParams(await req.text())
  }

  const grantType = params.get('grant_type')
  const code = params.get('code') ?? ''
  const codeVerifier = params.get('code_verifier') ?? ''

  if (grantType !== 'authorization_code') {
    return oauthError('unsupported_grant_type', 400)
  }

  const secret = Deno.env.get('CRM_MCP_TOKEN')
  if (!secret) return oauthError('server_error', 500)

  const payload = await verifyAuthCode(code, secret)
  if (!payload) return oauthError('invalid_grant', 400)

  const computedChallenge = await sha256Base64url(codeVerifier)
  if (!(await timingSafeEqual(computedChallenge, payload.code_challenge))) {
    return oauthError('invalid_grant', 400)
  }

  return new Response(
    JSON.stringify({ access_token: secret, token_type: 'Bearer', expires_in: 31536000 }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}
```

- [ ] **Step 2: Add the import and router entry in `index.ts`**

Change the import line to:
```typescript
import { handleMetadata, handleRegister, handleAuthorizeGet, handleAuthorizePost, handleToken } from './oauth.ts'
```

Add to the router block:
```typescript
  if (req.method === 'POST' && pathname.endsWith('/token')) {
    return handleToken(req)
  }
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs` with the full-loop test**

Add this after the `/authorize` checks from Task 2, before `console.log('ALL CHECKS PASSED')`. This needs a real PKCE pair — Node's `crypto` module provides what's needed:

At the top of the file, add this import alongside the existing ones:
```javascript
import { createHash, randomBytes } from 'node:crypto'
```

Then add:
```javascript
  console.log('=== OAuth: full loop — authorize with real PKCE, then exchange at /token ===')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  const fullAuthRes = await fetch(`${BASE_URL}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      redirect_uri: REAL_REDIRECT,
      client_id: 'test-client',
      code_challenge: codeChallenge,
      state: 'test-state',
      token: TEST_TOKEN,
    }),
    redirect: 'manual',
  })
  const fullAuthLocation = fullAuthRes.headers.get('location')
  const issuedCode = new URL(fullAuthLocation).searchParams.get('code')
  console.log('issued code (truncated):', issuedCode.slice(0, 20) + '...')

  const tokenRes = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: issuedCode,
      code_verifier: codeVerifier,
    }),
  })
  const tokenBody = await tokenRes.json()
  console.log(JSON.stringify(tokenBody, null, 2))
  if (tokenBody.access_token !== TEST_TOKEN) {
    throw new Error(`expected access_token to equal TEST_TOKEN, got ${tokenBody.access_token}`)
  }

  console.log('=== OAuth: use the returned access_token against the real / JSON-RPC endpoint ===')
  const finalListRes = await rpc('tools/list', {}, 999, tokenBody.access_token)
  const finalNames = finalListRes.body.result.tools.map((t) => t.name)
  console.log('tools/list via OAuth-issued token, count:', finalNames.length)
  if (finalNames.length !== 19) throw new Error(`expected 19 tools, got ${finalNames.length}`)

  console.log('=== OAuth: /token with WRONG code_verifier (expect invalid_grant) ===')
  const wrongVerifierRes = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: issuedCode,
      code_verifier: 'totally-wrong-verifier',
    }),
  })
  const wrongVerifierBody = await wrongVerifierRes.json()
  console.log('status:', wrongVerifierRes.status, JSON.stringify(wrongVerifierBody))
  if (wrongVerifierRes.status !== 400 || wrongVerifierBody.error !== 'invalid_grant') {
    throw new Error('expected 400 invalid_grant for wrong code_verifier')
  }
```

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, plus: the full authorize → token exchange returns `access_token` equal to the test `CRM_MCP_TOKEN`; that token successfully calls `tools/list` and gets all 19 tools; a wrong `code_verifier` is correctly rejected with `invalid_grant`. Ends with `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/oauth.ts crm-app/supabase/functions/crm-mcp/index.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add /token endpoint, complete OAuth loop, full local verification"
```

---

### Task 4: README update + real claude.ai registration

**Files:**
- Modify: `crm-app/supabase/functions/crm-mcp/README.md`

**Interfaces:**
- Consumes: nothing new — documents Tasks 1-3's shipped behavior.
- Produces: nothing consumed by later tasks (final task).

- [ ] **Step 1: Update the "Register in claude.ai" section of `README.md`**

Replace the existing "Register in claude.ai" section (the one describing "Advanced settings / Request headers") with:

```markdown
## Register in claude.ai

1. Redeploy `crm-mcp` with the new files (`oauth.ts`, updated `index.ts`, `auth.ts`, `jsonRpc.ts`) via
   the Supabase Dashboard — same process as before (see "Deploy" above), just with the additional
   OAuth files included.
2. claude.ai → Settings → Connectors → **Add custom connector**.
3. Paste the function URL: `https://<project-ref>.functions.supabase.co/functions/v1/crm-mcp`.
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

- [ ] **Step 2: Run the full verification script one final time**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: `ALL CHECKS PASSED`, confirming the README addition (docs-only) didn't break anything.

- [ ] **Step 3: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/README.md
git commit -m "docs(crm-mcp): update claude.ai registration steps for OAuth flow"
```

---

## Post-plan note

Deploying the updated `crm-mcp` and actually re-adding the connector in claude.ai are manual,
human-driven steps requiring the real Supabase Dashboard and claude.ai account — same limitation
as every prior deploy step in this project. The deliverable of this plan is a fully built, locally
verified OAuth layer; the real deploy + real registration attempt is the user's next action, and
its outcome (especially at the discovery step, per the disclosed residual risk) should be reported
back rather than assumed to work.
