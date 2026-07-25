# crm-mcp /authorize HTML Rendering Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/authorize` render as an interactive HTML form in the browser instead of raw source text, so a user can actually enter their `CRM_MCP_TOKEN` and finish connecting the claude.ai Custom Connector.

**Architecture:** Move only HTML rendering (the token-entry form and its wrong-token error redisplay) from the Supabase Edge Function (`crm-mcp`) to the Vercel Edge Middleware proxy (`middleware.ts`), since Supabase force-downgrades any `text/html` Edge Function response under the shared `*.supabase.co` domain to `text/plain` with a locked-down sandbox CSP, and Vercel has no such restriction. Token verification (PKCE, HMAC-signed codes, timing-safe comparison) stays entirely in Supabase, unchanged. The two sides are connected by an HTTP redirect on wrong-token failure — redirects have no body/content-type, so they're unaffected by Supabase's HTML restriction.

**Tech Stack:** Vercel Edge Middleware (TypeScript, Web-standard `Request`/`Response`), Supabase Edge Function (Deno/TypeScript).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-mcp-connector-authorize-html-fix-design.md` — approved, do not deviate from its Decision/Architecture/Security Boundary sections.
- No change to PKCE validation, HMAC signing, timing-safe comparison, or `ALLOWED_REDIRECT_URIS` enforcement — all stay server-side in `crm-mcp`, exactly as today.
- `handleAuthorizeGet` in `crm-mcp/oauth.ts` is left as-is (unreachable in the intended flow once Vercel intercepts `GET /authorize` first, but kept as a defense-in-depth fallback).
- The success path (`POST /authorize` with a correct token → 302 to `claude.ai`) is untouched.
- Any Supabase deploy step must go through the Dashboard (paste-and-deploy via `DEPLOY_BUNDLE.ts`) — no `supabase functions deploy` CLI instructions, per this project's standing convention.
- Follow this project's established worktree convention: implement on a new branch off `main` in a worktree at `crm-app/.worktrees/mcp-authorize-html-fix`, created via `superpowers:using-git-worktrees` at execution time. Do **not** use `isolation: "worktree"` on the Agent tool for task dispatch — that caused a real incident on the prior `bare-root-proxy` plan (committed straight to `main` instead of the branch). Dispatch subagents with an instruction to `cd` into the existing worktree path instead.

---

### Task 1: Vercel-side form rendering (`authorize-form.ts` + `middleware.ts`)

**Files:**

- Create: `authorize-form.ts` (project root, alongside `middleware.ts`)
- Modify: `middleware.ts`
- Modify: `scripts/verify-middleware.mjs`

**Interfaces:**

- Produces: `authorize-form.ts` exports `ALLOWED_REDIRECT_URIS: string[]`, `escapeHtml(s: string): string`, `renderAuthorizeForm(params: { redirectUri: string; clientId: string; codeChallenge: string; state: string; error?: string }): Response`. `middleware.ts` gains a new branch matched on `GET /authorize`, checked before the existing generic proxy branch.
- Consumes: nothing new from other tasks (this task is self-contained on the Vercel side).

- [ ] **Step 1: Add the failing test cases to `scripts/verify-middleware.mjs`**

Open `scripts/verify-middleware.mjs`. Add this helper near the top, right after the `fetch` mock is installed (after line 16, before `const { default: middleware } = await import('../middleware.ts')`):

```javascript
function authorizeUrl(params) {
  const u = new URL('https://brisk-crm.vercel.app/authorize')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, v)
  }
  return u.toString()
}
```

Then, inside `main()`, insert this block right after the existing `'=== POST /authorize: upstream 302 redirect passes through untouched ==='` block and before `'=== Missing SUPABASE_CRM_MCP_URL returns 502 ==='`:

```javascript
  console.log('=== GET /authorize with valid params renders the form locally (200, HTML) ===')
  const callsBeforeValidAuthorize = calls.length
  const validAuthorizeRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client_id: 'test-client',
      code_challenge: 'abc123',
      code_challenge_method: 'S256',
      state: 'xyz',
    }),
    { method: 'GET' },
  ))
  if (validAuthorizeRes.status !== 200) {
    throw new Error(`expected 200 for valid GET /authorize, got ${validAuthorizeRes.status}`)
  }
  const validAuthorizeHtml = await validAuthorizeRes.text()
  if (!validAuthorizeHtml.includes('name="token"')) {
    throw new Error('expected rendered form to contain the token input field')
  }
  if (calls.length !== callsBeforeValidAuthorize) {
    throw new Error('expected GET /authorize to be rendered locally, not proxied to Supabase')
  }

  console.log('=== GET /authorize with invalid redirect_uri returns 400 ===')
  const badRedirectRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://evil.example.com/cb',
      client_id: 'test-client',
      code_challenge: 'abc123',
      code_challenge_method: 'S256',
      state: 'xyz',
    }),
    { method: 'GET' },
  ))
  if (badRedirectRes.status !== 400) {
    throw new Error(`expected 400 for invalid redirect_uri, got ${badRedirectRes.status}`)
  }

  console.log('=== GET /authorize with missing code_challenge_method returns 400 ===')
  const missingPkceRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client_id: 'test-client',
      code_challenge: 'abc123',
      state: 'xyz',
    }),
    { method: 'GET' },
  ))
  if (missingPkceRes.status !== 400) {
    throw new Error(`expected 400 for missing code_challenge_method, got ${missingPkceRes.status}`)
  }

  console.log('=== GET /authorize with error=invalid_token shows the error message ===')
  const errorRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client_id: 'test-client',
      code_challenge: 'abc123',
      code_challenge_method: 'S256',
      state: 'xyz',
      error: 'invalid_token',
    }),
    { method: 'GET' },
  ))
  if (errorRes.status !== 200) {
    throw new Error(`expected 200 for GET /authorize with error param, got ${errorRes.status}`)
  }
  const errorHtml = await errorRes.text()
  if (!errorHtml.includes('Incorrect token')) {
    throw new Error('expected rendered form to include the error message when error=invalid_token')
  }
```

- [ ] **Step 2: Run the harness and confirm the new cases fail**

Run: `npx tsx scripts/verify-middleware.mjs`
Expected: fails on the first new check (`expected 200 for valid GET /authorize, got 302`) — today, `GET /authorize` falls through to the generic proxy branch and hits the test's mocked `fetch`, which returns a 302 for any URL containing `/authorize`. This confirms the test is exercising real (currently-missing) behavior.

- [ ] **Step 3: Create `authorize-form.ts`**

Create `authorize-form.ts` at the project root (same directory as `middleware.ts`):

```typescript
export const ALLOWED_REDIRECT_URIS = ['https://claude.ai/api/mcp/auth_callback']

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderAuthorizeForm(params: {
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
  ${params.error ? `<p style="color:#c00">${escapeHtml(params.error)}</p>` : ''}
  <form method="POST">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
    <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
    <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
    <input type="password" name="token" placeholder="CRM_MCP_TOKEN"
      style="width:100%;padding:8px;margin:12px 0;box-sizing:border-box;" autofocus />
    <button type="submit" style="padding:8px 16px;">Authorize</button>
  </form>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  })
}
```

This is a line-for-line port of `supabase/functions/crm-mcp/oauth.ts`'s `escapeHtml`/`ALLOWED_REDIRECT_URIS`/`renderAuthorizeForm` (same HTML template, same `X-Frame-Options`/CSP headers), minus the `...CORS` header spread — CORS only matters for cross-origin `fetch`/XHR, not a full-page browser navigation, and `middleware.ts` has no `CORS` constant to spread.

- [ ] **Step 4: Add the `GET /authorize` branch to `middleware.ts`**

Modify `middleware.ts`. Add the import at the top:

```typescript
import { next } from '@vercel/functions'
import { ALLOWED_REDIRECT_URIS, renderAuthorizeForm } from './authorize-form'
```

Then insert a new branch immediately after the existing `GET /` passthrough block (after line 21, before the `const target = process.env.SUPABASE_CRM_MCP_URL` line):

```typescript
  if (url.pathname === '/authorize' && request.method === 'GET') {
    const redirectUri = url.searchParams.get('redirect_uri') ?? ''
    const clientId = url.searchParams.get('client_id') ?? ''
    const codeChallenge = url.searchParams.get('code_challenge') ?? ''
    const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? ''
    const state = url.searchParams.get('state') ?? ''
    const errorParam = url.searchParams.get('error') ?? ''

    if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
      return new Response('Invalid redirect_uri', { status: 400 })
    }
    if (codeChallengeMethod !== 'S256' || !codeChallenge) {
      return new Response('PKCE code_challenge (S256) is required', { status: 400 })
    }

    return renderAuthorizeForm({
      redirectUri,
      clientId,
      codeChallenge,
      state,
      error: errorParam === 'invalid_token' ? 'Incorrect token — try again.' : undefined,
    })
  }
```

Every other matched path — including `POST /authorize` — falls through to the existing generic proxy code below, unchanged.

- [ ] **Step 5: Type-check `middleware.ts` (and, transitively, `authorize-form.ts`)**

`middleware.ts` lives outside `src/`, so it isn't covered by `tsconfig.app.json`/`tsconfig.node.json` and `npx tsc -b` silently skips it (this is why this project type-checks it directly — see the prior bare-root-proxy plan).

Run:

```bash
npx tsc --noEmit --ignoreConfig --types node --target es2022 --lib es2022,dom --module esnext --moduleResolution bundler middleware.ts authorize-form.ts
```

**Correction (post-merge):** an earlier version of this step imported `authorize-form.ts` with an explicit `.ts` extension and added `--allowImportingTsExtensions` here to satisfy `tsc`. That masked a real problem instead of fixing it: Vercel's Edge Function bundler rejects modules referenced with an explicit `.ts` extension outright (`The Edge Function "middleware" is referencing unsupported modules: ./authorize-form.ts`), so the deploy failed even though this local type-check passed. The fix is to import without the extension (`from './authorize-form'`) — this project's `--moduleResolution bundler` setting resolves that exactly the way Vercel's own bundler does, and the extra flag is no longer needed.

Expected: no output, exit code 0.

- [ ] **Step 6: Run the harness and confirm all cases pass**

Run: `npx tsx scripts/verify-middleware.mjs`
Expected: `ALL CHECKS PASSED` at the end, no thrown errors.

- [ ] **Step 7: Commit**

```bash
git add authorize-form.ts middleware.ts scripts/verify-middleware.mjs
git commit -m "feat: render /authorize form on Vercel instead of Supabase"
```

---

### Task 2: Supabase-side redirect-on-failure (`oauth.ts` + `DEPLOY_BUNDLE.ts`)

**Files:**

- Modify: `supabase/functions/crm-mcp/oauth.ts`
- Modify: `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts`
- Modify: `supabase/functions/crm-mcp/scripts/verify-http.mjs`

**Interfaces:**

- Consumes: nothing from Task 1 — `crm-mcp` never needs to know its own public URL for this redirect, since it's built as a relative path (`/authorize?...`) that the browser resolves against whatever origin it's currently on.
- Produces: on a wrong token, `handleAuthorizePost` now returns a 302 with `Location: /authorize?redirect_uri=...&client_id=...&code_challenge=...&code_challenge_method=S256&state=...&error=invalid_token` instead of a 200 HTML body. This is what Task 1's `middleware.ts` `GET /authorize` branch consumes when the browser follows the redirect back.

- [ ] **Step 1: Update the failing assertion in `verify-http.mjs`**

Open `supabase/functions/crm-mcp/scripts/verify-http.mjs`. Replace the existing block:

```javascript
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
```

with:

```javascript
  console.log('=== OAuth: POST /authorize with WRONG token (expect 302 back to /authorize with error) ===')
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
  const wrongTokenLocation = wrongTokenRes.headers.get('location')
  console.log('location:', wrongTokenLocation)
  if (wrongTokenRes.status !== 302) {
    throw new Error(`expected 302 for wrong token, got ${wrongTokenRes.status}`)
  }
  if (!wrongTokenLocation || !wrongTokenLocation.startsWith('/authorize')) {
    throw new Error(`expected redirect Location to start with /authorize (relative), got ${wrongTokenLocation}`)
  }
  if (!wrongTokenLocation.includes('error=invalid_token')) {
    throw new Error(`expected redirect Location to include error=invalid_token, got ${wrongTokenLocation}`)
  }
  if (!wrongTokenLocation.includes(`code_challenge=${encodeURIComponent(CODE_CHALLENGE)}`)) {
    throw new Error(`expected redirect Location to preserve code_challenge, got ${wrongTokenLocation}`)
  }
  if (!wrongTokenLocation.includes('code_challenge_method=S256')) {
    throw new Error(`expected redirect Location to include code_challenge_method=S256, got ${wrongTokenLocation}`)
  }
```

- [ ] **Step 2: Run the harness and confirm it fails**

Run: `cd supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: fails at `expected 302 for wrong token, got 200` — today, a wrong token still returns the rendered HTML form directly.

- [ ] **Step 3: Change `handleAuthorizePost` in `oauth.ts`**

In `supabase/functions/crm-mcp/oauth.ts`, replace:

```typescript
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected || !(await timingSafeEqual(token, expected))) {
    return renderAuthorizeForm({
      redirectUri, clientId, codeChallenge, state,
      error: 'Incorrect token — try again.',
    })
  }
```

with:

```typescript
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected || !(await timingSafeEqual(token, expected))) {
    const retry = new URL('/authorize', 'https://placeholder.invalid')
    retry.searchParams.set('redirect_uri', redirectUri)
    retry.searchParams.set('client_id', clientId)
    retry.searchParams.set('code_challenge', codeChallenge)
    retry.searchParams.set('code_challenge_method', 'S256')
    retry.searchParams.set('state', state)
    retry.searchParams.set('error', 'invalid_token')
    return new Response(null, {
      status: 302,
      headers: { ...CORS, Location: `${retry.pathname}${retry.search}` },
    })
  }
```

`code_challenge_method` is hardcoded to `'S256'` because it's the only value this server ever accepts (`code_challenge_methods_supported: ['S256']` in the metadata endpoint) — the original submitted form never carries `code_challenge_method` as a hidden field (only `redirect_uri`/`client_id`/`code_challenge`/`state`), so it isn't available to read back here, but it doesn't need to be: it's always the same constant. The placeholder base URL is a throwaway used only so `URL` can build and encode the query string correctly; `retry.pathname` + `retry.search` extracts just the relative path, which is what actually gets sent as `Location` — this is what makes the browser resolve it against whatever origin it's currently on, per the spec.

`renderAuthorizeForm`, `escapeHtml`, and `handleAuthorizeGet` are **not removed** — `handleAuthorizeGet` still calls `renderAuthorizeForm` and remains as the defense-in-depth fallback described in the spec.

- [ ] **Step 4: Type-check**

Run: `cd supabase/functions/crm-mcp && npx deno check oauth.ts index.ts`
Expected: two `Check` lines, no errors.

- [ ] **Step 5: Run the harness and confirm it passes**

Run: `cd supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: `ALL CHECKS PASSED` at the end. (The later `'OAuth: POST /authorize with CORRECT token'` and `'full loop'` checks must still pass unmodified — the success path was not touched.)

- [ ] **Step 6: Mirror the same change into `DEPLOY_BUNDLE.ts`**

In `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts`, find its own copy of `handleAuthorizePost` (same body as `oauth.ts`, just not `export`ed — it's a single-file bundle). Replace:

```typescript
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected || !(await timingSafeEqual(token, expected))) {
    return renderAuthorizeForm({
      redirectUri, clientId, codeChallenge, state,
      error: 'Incorrect token — try again.',
    })
  }
```

with:

```typescript
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected || !(await timingSafeEqual(token, expected))) {
    const retry = new URL('/authorize', 'https://placeholder.invalid')
    retry.searchParams.set('redirect_uri', redirectUri)
    retry.searchParams.set('client_id', clientId)
    retry.searchParams.set('code_challenge', codeChallenge)
    retry.searchParams.set('code_challenge_method', 'S256')
    retry.searchParams.set('state', state)
    retry.searchParams.set('error', 'invalid_token')
    return new Response(null, {
      status: 302,
      headers: { ...CORS, Location: `${retry.pathname}${retry.search}` },
    })
  }
```

This file is a hand-mirrored single-file paste-deploy target — per its own header comment, whenever modular source logic changes, this bundle must be regenerated to match, not left to drift. `renderAuthorizeForm`, `escapeHtml`, and `handleAuthorizeGet` stay as-is here too, for the same reason as Step 3.

- [ ] **Step 7: Type-check the bundle**

Run: `cd supabase/functions/crm-mcp && npx deno check DEPLOY_BUNDLE.ts`
Expected: `Check DEPLOY_BUNDLE.ts`, no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/crm-mcp/oauth.ts supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "fix: redirect instead of re-rendering HTML on wrong /authorize token"
```

---

## Post-merge: manual deploy & verify (user, after both tasks are merged to `main`)

Vercel Edge Middleware and a live Supabase deploy can't be exercised by local scripts — this final check is inherently manual, same category as the prior `bare-root-proxy` work.

1. **Supabase Dashboard** → Edge Functions → `crm-mcp` → paste the updated `DEPLOY_BUNDLE.ts` contents as `index.ts` → Deploy. (No CLI — Dashboard paste-and-deploy only, per this project's convention.)
2. Vercel redeploys automatically once Task 1's commit reaches `main` (git-integration auto-deploy) — confirm the new deployment is live in the Vercel dashboard.
3. Visit the real `/authorize` URL (with valid `redirect_uri`/`client_id`/`code_challenge`/`code_challenge_method=S256`/`state` query params, e.g. by re-triggering the claude.ai connector registration flow) — confirm it renders as an actual interactive form, not raw HTML text.
4. Submit an intentionally wrong token — confirm you land back on `/authorize` with the "Incorrect token — try again." message shown inline, form still interactive.
5. Submit the real `CRM_MCP_TOKEN` — confirm the browser redirects to `claude.ai` and the connector shows as connected.
6. Ask Claude to search for a real prospect through the connector to confirm the full round-trip works end to end.
