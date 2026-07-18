# crm-mcp Bare-Root Proxy — Design

## Problem

claude.ai's Custom Connector registration for `crm-mcp` keeps failing
(`mcp_registration_failed`) even after the OAuth 2.1 layer (commit `12ca3a2`) and
the RFC 9728 Protected Resource Metadata fix (commit `094d0eb`) were deployed.

Root cause: the connector's Server URL is
`https://<project-ref>.supabase.co/functions/v1/crm-mcp` — a URL with a path
component. Both RFC 8414 (Authorization Server Metadata) and RFC 9728
(Protected Resource Metadata) define a well-known-URI construction algorithm
that, for an issuer/resource with a path, **inserts** the well-known segment
between the host and the path:

```
https://<ref>.supabase.co/.well-known/oauth-authorization-server/functions/v1/crm-mcp
```

That URL falls outside `/functions/v1/*`, the only prefix Supabase's platform
routing ever forwards to an Edge Function — it 404s at Supabase's
infrastructure, before any of our code runs. This applies to both discovery
documents, which is why the RFC 9728 fix alone did not resolve registration:
its endpoint, reachable only via naive path concatenation, is never reached by
a spec-compliant client following the insertion algorithm.

When an issuer/resource URL has **no path component**, insertion and naive
concatenation produce the identical URL, eliminating the ambiguity entirely.
This is why other SaaS MCP connectors present a bare-root URL
(`https://mcp.example.com`) rather than a URL with a service path.

## Decision

Reuse the existing `brisk-crm.vercel.app` app domain as the connector's public
identity (not a new custom domain — the user may add one later and repoint
this later). Introduce a Vercel Edge Middleware that proxies the MCP/OAuth
surface to the real `crm-mcp` Supabase function, so the connector's Server URL
becomes the bare root `https://brisk-crm.vercel.app` with zero path.

## Architecture

`crm-app/middleware.ts` (new, project root) runs on every request before
Vercel's routing/rewrites. Its matcher is scoped to only the paths that need
interception:

- `/` — but only `POST` and `OPTIONS` (the MCP JSON-RPC endpoint); `GET /`
  passes through untouched so the SPA's existing catch-all rewrite
  (`{ "source": "/(.*)", "destination": "/index.html" }` in `vercel.json`)
  still serves the app's homepage.
- `/register`, `/authorize`, `/token`, `/.well-known/oauth-authorization-server`,
  `/.well-known/oauth-protected-resource` — any method. Confirmed via `grep`
  that no existing React Router route in `src/App.tsx` uses any of these
  paths, so there is no collision with the SPA.

For matched requests, the middleware proxies by fetching
`${SUPABASE_CRM_MCP_URL}${pathname}` with the same method, headers, and body,
and returns that response directly (short-circuiting Vercel's routing rather
than rewriting to a local path). `SUPABASE_CRM_MCP_URL` is a new Vercel
project environment variable, e.g.
`https://wrtyatftfipchzrsehvl.supabase.co/functions/v1/crm-mcp`.

If the proxy fetch fails (misconfigured env var, Supabase function
unreachable), the middleware returns `502` with a short JSON error body —
deliberately not falling through to the SPA, since a claude.ai/OAuth client
expecting JSON must never silently receive an `index.html` payload.

## crm-mcp changes (`supabase/functions/crm-mcp/oauth.ts`)

- `crmMcpBaseUrl()` is unchanged (still used internally as the fallback and by
  anything that must reference the function's real Supabase address).
- New `publicBaseUrl()`: returns `Deno.env.get('MCP_PUBLIC_URL') ??
  crmMcpBaseUrl()`. `MCP_PUBLIC_URL` is a new Supabase Edge Function secret,
  e.g. `https://brisk-crm.vercel.app`, set only in production. Left unset,
  behavior (and existing tests) are unchanged — this keeps local
  `verify-http.mjs` runs working with zero setup.
- Every externally-visible URL switches from `crmMcpBaseUrl()` to
  `publicBaseUrl()`: `handleMetadata`'s `issuer`/`authorization_endpoint`/
  `token_endpoint`/`registration_endpoint`, `handleProtectedResourceMetadata`'s
  `resource`/`authorization_servers`, and `protectedResourceMetadataUrl()`
  (used in the `WWW-Authenticate` header on 401).
- `ALLOWED_REDIRECT_URIS` (claude.ai's own fixed callback URL) is unrelated
  and untouched.
- `DEPLOY_BUNDLE.ts` gets the same changes mirrored in, as with every prior
  `crm-mcp` change, and is re-verified (`deno check` + local smoke test)
  before being considered ready to paste into the Supabase Dashboard.

## Settings UI change (`src/components/settings/McpConnectorCard.tsx`)

The card currently displays `${VITE_SUPABASE_URL}/functions/v1/crm-mcp` as the
URL to paste into claude.ai. It changes to display the bare Vercel root
instead (a new `VITE_MCP_PUBLIC_URL` env var, falling back to
`window.location.origin` if unset, since the app is already served from that
same domain). The "Test Connection" button's reachability check continues to
work unchanged — it just now hits the bare root instead of the Supabase path.

## Data Flow (fresh connector add)

1. User pastes `https://brisk-crm.vercel.app` as the Server URL in claude.ai.
2. claude.ai fetches discovery metadata at the bare root — no path insertion
   ambiguity under either RFC 8414 or RFC 9728. Vercel middleware proxies this
   straight to `crm-mcp`.
3. Metadata comes back with every endpoint URL rooted at
   `https://brisk-crm.vercel.app/...` (via `publicBaseUrl()`).
4. DCR (`/register`), the browser-rendered `/authorize` token-entry page, and
   `/token` are all proxied transparently, all under the same origin.
5. Once claude.ai holds an access token, `POST
   https://brisk-crm.vercel.app/` carries real MCP JSON-RPC traffic, proxied
   the same way.

## Testing

- `verify-http.mjs` is unaffected — it still drives the real Deno function
  directly. One assertion is added: with `MCP_PUBLIC_URL` unset, metadata
  URLs fall back to the existing Supabase-URL shape (regression guard for the
  fallback logic).
- The middleware itself is a Vercel-only runtime and cannot be exercised by
  that script. Verification here is necessarily a manual post-deploy step:
  after deploying, `curl https://brisk-crm.vercel.app/.well-known/oauth-authorization-server`
  and confirm it returns the proxied JSON (not `index.html`), then retry
  adding the connector in claude.ai.

## Out of scope

- Migrating to a dedicated custom domain/subdomain — deferred; this design
  keeps `publicBaseUrl()` and the middleware's target env var as the only two
  places that would need to change if/when that happens.
- Any change to the OAuth flow's security properties (PKCE, HMAC-signed
  codes, XSS/security headers) — all of that is unchanged from the existing
  OAuth layer; this fix is purely about URL/routing shape.
