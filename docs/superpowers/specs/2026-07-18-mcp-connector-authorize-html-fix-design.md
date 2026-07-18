# crm-mcp /authorize HTML Rendering Fix — Design

## Problem

After deploying the bare-root Vercel Edge Middleware proxy (see
`2026-07-18-mcp-connector-bare-root-proxy-design.md`), the user completed a
live end-to-end test in claude.ai: discovery, Dynamic Client Registration,
and the redirect to `/authorize` all worked correctly. But the `/authorize`
page itself rendered as raw HTML *source text* in the browser instead of an
interactive form — blocking the user from ever entering their
`CRM_MCP_TOKEN` to finish connecting.

Root cause, confirmed via `superpowers:systematic-debugging` (curl against
both the Vercel-proxied URL and the Supabase URL directly, producing
identical results in both cases): Supabase deliberately rewrites any
`text/html` response from an Edge Function served under the shared
`*.supabase.co` domain to `Content-Type: text/plain` with a locked-down
`Content-Security-Policy: default-src 'none'; sandbox` — a platform security
measure to stop their shared domain from hosting arbitrary HTML/phishing
pages (documented at
[supabase/discussions#35627](https://github.com/orgs/supabase/discussions/35627)).
This is not a bug in `middleware.ts` or `oauth.ts` — the middleware faithfully
relays exactly what Supabase serves.

The only clean workaround Supabase itself offers (Pro plan + paid Custom
Domain add-on) was rejected in favor of the free option: **rendering the
`/authorize` page's HTML on Vercel instead of Supabase**, since Vercel has no
such restriction.

## Decision

`crm-mcp`'s actual token verification (the security-sensitive part: PKCE
validation, timing-safe comparison, HMAC-signed auth-code minting) stays
exactly where it is today, in Supabase. Only the HTML rendering — the
initial token-entry form and the "wrong token, try again" redisplay — moves
to Vercel. The two are connected by an HTTP redirect on failure, since
redirects have no body/content-type and are therefore completely unaffected
by Supabase's HTML restriction.

## Architecture

Two Vercel-side pieces, alongside the existing `middleware.ts`:

- **`authorize-form.ts`** (new file, project root): a standalone module
  holding `escapeHtml()`, the `ALLOWED_REDIRECT_URIS` allowlist, and
  `renderAuthorizeForm()` — a line-for-line port of `crm-mcp/oauth.ts`'s
  existing function of the same name and shape (same HTML template, same
  `X-Frame-Options`/CSP security headers), with an added optional inline
  error message read from an `error` query param. This duplication mirrors
  the precedent already established by `DEPLOY_BUNDLE.ts` hand-mirroring
  `oauth.ts`'s logic for a different runtime — Vercel's Edge Middleware and
  Supabase's Deno function are separate deployments that cannot share a
  module.
- **`middleware.ts`** gains one new branch, checked before the existing
  generic proxy branch: `GET /authorize` is rendered locally by calling
  `authorize-form.ts`, performing the same `redirect_uri` allowlist and PKCE
  (`code_challenge_method === 'S256'` and `code_challenge` present) checks
  `crm-mcp` performs today, returning 400 on failure exactly as `crm-mcp`
  does. Every other matched path — **including `POST /authorize`** — keeps
  proxying to Supabase exactly as it does today, unchanged.

`crm-mcp/oauth.ts`'s `handleAuthorizePost` changes in exactly one place: on a
wrong token, instead of `return renderAuthorizeForm({..., error: '...'})`
(HTML, which Supabase would sandbox), it returns a **302 redirect** to
`/authorize` with the original `redirect_uri`/`client_id`/`code_challenge`/
`state` plus `&error=invalid_token` appended, built as a relative path (no
scheme/host) so the browser resolves it against whatever origin it's
currently on (`https://brisk-crm.vercel.app`) — `crm-mcp` never needs to know
its own public URL for this. The **success path is completely untouched**:
it already returns a 302 to `claude.ai`, which was never HTML and was never
broken.

`handleAuthorizeGet` in `crm-mcp` is left as-is — it becomes unreachable in
the intended flow (Vercel now intercepts `GET /authorize` first) but remains
as harmless dead code / a defense-in-depth fallback if `crm-mcp`'s Supabase
URL is ever hit directly, bypassing the proxy.

## Data Flow

**Fresh visit:** claude.ai redirects the browser to
`GET https://brisk-crm.vercel.app/authorize?...` → Vercel validates params
and renders the form directly (no proxy call at all for this case).

**Wrong token submitted:** `POST .../authorize` (proxied to Supabase as
today) → Supabase validates, timing-safe-compares against `CRM_MCP_TOKEN`,
fails → 302 to `/authorize?...&error=invalid_token` → browser follows it
back to the same Vercel origin → Vercel renders the same form with the error
message inline (no new round trip logic needed — it's the same GET branch,
now with `error` set).

**Correct token submitted:** `POST .../authorize` (proxied, unchanged) →
Supabase validates, signs an HMAC auth code, 302s to
`https://claude.ai/api/mcp/auth_callback?code=...&state=...` exactly as
today.

## Security Boundary

Vercel's `GET /authorize` validation (`redirect_uri` allowlist, PKCE
presence) is UX-only, a courtesy for a nicer error message before the user
even fills anything in. `crm-mcp`'s `handleAuthorizePost` independently
re-validates both before ever minting a signed code — this was already true
before this change and is not weakened by it. There is no path by which
Vercel's copy of the allowlist being wrong or out of sync could let an
invalid `redirect_uri` actually receive a signed code; that check is
enforced server-side in Supabase regardless of what Vercel does or doesn't
render.

## Testing

- `scripts/verify-middleware.mjs` gains cases for the new branch: valid
  params render a 200 response with HTML containing the token input field;
  an invalid `redirect_uri` and a missing/wrong `code_challenge_method` each
  return 400; an `error=invalid_token` query param produces HTML containing
  the error text.
- `supabase/functions/crm-mcp/scripts/verify-http.mjs`'s existing
  wrong-token assertion changes from expecting re-rendered HTML to expecting
  a 302 response whose `Location` header points at `/authorize` with
  `error=invalid_token` in the query string.
- Manual post-deploy check (same category as the original bare-root-proxy
  work — Vercel Edge Middleware can't be exercised by local scripts):
  visit the real `/authorize` URL in a browser, confirm the form renders as
  an actual interactive page, submit a wrong token, confirm the error
  re-render works, then submit the real token and confirm the full
  connector flow completes in claude.ai.

## Out of scope

- Any change to PKCE, HMAC signing, timing-safe comparison, or
  `ALLOWED_REDIRECT_URIS`'s actual enforcement — all unchanged, still
  enforced server-side in `crm-mcp`.
- Migrating to Supabase's paid Custom Domain add-on — explicitly rejected by
  the user in favor of this no-cost fix.
- `crm-mcp/oauth.ts`'s `handleAuthorizeGet` is not removed or modified, only
  rendered unreachable in the intended flow.
