# CRM MCP Connector — Minimal OAuth 2.1 Layer — Design Spec

## Problem

The v2 remote connector (`crm-mcp`, shipped and deployed) was designed around a single shared
bearer token, configured in claude.ai's "Advanced settings → Request headers" — but that feature
is in beta rollout and not available on this account. Confirmed by a real attempt: adding the
connector with blank OAuth fields produced *"Couldn't register with BRISK CRM's sign-in
service"*, meaning claude.ai attempted OAuth Dynamic Client Registration (DCR) against the
function automatically. There is no way to register this connector without `crm-mcp` speaking
OAuth 2.1.

## Goal

Add a minimal OAuth 2.1 authorization-server layer directly to the existing `crm-mcp` edge
function so claude.ai's connector flow can register and authenticate against it, without turning
this into a real multi-tenant identity system.

## Non-goals

- No new Supabase table, no persisted client registrations, no persisted authorization codes —
  the whole layer is stateless (spec decision, see Architecture).
- No refresh token — the issued access token is `CRM_MCP_TOKEN` itself, which doesn't expire, so
  there is nothing to refresh.
- No change to the existing `/` JSON-RPC endpoint or its `checkAuth` bearer-token check — this
  layer only adds the endpoints claude.ai needs *before* it ever calls `/`.
- No support for Client ID Metadata Documents (CIMD) — plain Dynamic Client Registration (RFC
  7591) is implemented instead, since it's what the observed failure showed claude.ai attempting,
  and doesn't require this server to fetch and trust an external metadata document.

## Architecture

A new module, `supabase/functions/crm-mcp/oauth.ts`, implementing four endpoints. A small routing
change at the top of `index.ts`'s `Deno.serve` handler: before the existing JSON-RPC/`checkAuth`
logic runs, the request's pathname is checked against `/authorize`, `/token`, `/register`, and
`/.well-known/oauth-authorization-server` (matched with `.endsWith(...)`/`.includes(...)`, not
exact equality — Supabase may or may not strip the `/functions/v1/crm-mcp` prefix before the
handler sees the path, and this makes routing correct either way, verified directly rather than
assumed). Anything that doesn't match falls through to the existing, untouched `/` endpoint.

The authorization code is **self-signed**, not stored anywhere: it is
`base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, CRM_MCP_TOKEN))`, where the
payload is `{ redirect_uri, code_challenge, exp }`. `/token` re-derives and compares the HMAC,
checks `exp`, and checks that SHA-256(the caller's `code_verifier`) matches the embedded
`code_challenge` — all without a database round-trip. Since the eventual access token is just
`CRM_MCP_TOKEN` itself (a static secret that doesn't expire), no refresh token is ever issued.

## Components (endpoints)

| Endpoint | Method | Purpose |
|---|---|---|
| `/.well-known/oauth-authorization-server` | GET | Metadata: `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `code_challenge_methods_supported: ["S256"]`, `token_endpoint_auth_methods_supported: ["none"]` |
| `/register` | POST | RFC 7591 Dynamic Client Registration — generates and returns a fresh random `client_id`; nothing persisted |
| `/authorize` | GET | Validates `redirect_uri` against a hardcoded allowlist (`https://claude.ai/api/mcp/auth_callback`); serves a minimal HTML page with a single `CRM_MCP_TOKEN` input field |
| `/authorize` | POST | Verifies the submitted token (reusing the same `timingSafeEqual` comparison `auth.ts`'s `checkAuth` already uses); on match, issues the signed code and redirects to `redirect_uri?code=...&state=...`; on mismatch, re-renders the form with an inline error, no code issued |
| `/token` | POST | Verifies the code's HMAC signature, `exp` (~5 minute lifetime), and PKCE `code_verifier`; returns `{ access_token: CRM_MCP_TOKEN, token_type: "Bearer", expires_in: 31536000 }` |

`index.ts`'s existing `/` JSON-RPC endpoint and `auth.ts`'s `checkAuth` are unmodified — Claude
ends up sending `Authorization: Bearer <CRM_MCP_TOKEN>` there either way, just arrived at through
the OAuth dance instead of a manually-pasted header.

## Data flow (the full sequence claude.ai runs)

1. User adds the `crm-mcp` URL as a Custom Connector in claude.ai, with no OAuth fields filled.
2. Claude fetches `/.well-known/oauth-authorization-server`, learns the other endpoint URLs.
3. Claude `POST`s to `/register` (no auth) → gets back a `client_id`.
4. Claude generates a PKCE `code_verifier` + `code_challenge`, opens
   `/authorize?client_id=...&redirect_uri=https://claude.ai/api/mcp/auth_callback&code_challenge=...&code_challenge_method=S256&state=...`.
5. `/authorize` checks `redirect_uri` against the allowlist (rejects anything else with 400 — this
   is what stops an attacker from registering a different redirect and stealing a code), then
   shows the token-entry form.
6. User submits their `CRM_MCP_TOKEN`. `/authorize` verifies it, signs a code embedding
   `{redirect_uri, code_challenge, exp: now + 5min}`, redirects the browser to
   `https://claude.ai/api/mcp/auth_callback?code=...&state=...`.
7. Claude's backend `POST`s to `/token` with the code and its original `code_verifier`. `/token`
   re-verifies the HMAC signature, checks `exp`, hashes `code_verifier` and compares to the
   embedded `code_challenge` — only then returns `access_token: CRM_MCP_TOKEN`.
8. Every subsequent tool call hits `/` with `Authorization: Bearer <CRM_MCP_TOKEN>` — exactly
   what `checkAuth` already expects, completely unchanged.

## Error handling

- Unregistered/mismatched `redirect_uri` at `/authorize`: 400, no code issued, no form shown at
  all — nothing to gain by revealing the form to a request that could never complete legitimately.
- Wrong token submitted at `/authorize`: re-render the form with an inline error, no code issued,
  no information leaked about *why* it's wrong.
- Expired, tampered, or signature-invalid code at `/token`: 400 with `{error: "invalid_grant"}`
  (standard OAuth error shape clients expect to parse).
- PKCE `code_verifier` mismatch at `/token`: same `invalid_grant` treatment, deliberately not
  distinguished from "expired code" — an attacker probing `/token` can't learn which check failed.

## Testing / verification

No automated test suite (matches v1/v2 convention). `scripts/verify-http.mjs` is extended to run
the full loop locally, with a test `CRM_MCP_TOKEN`:
1. Fetch `/.well-known/oauth-authorization-server`, check its shape.
2. `POST /register`, check a `client_id` comes back.
3. `GET /authorize` with a bad `redirect_uri`, confirm 400.
4. `POST /authorize` with the wrong token, confirm no code/redirect.
5. `POST /authorize` with the right token, confirm a redirect containing a `code`.
6. `POST /token` with that code + the matching `code_verifier`, confirm `access_token` equals the
   test token.
7. Feed that `access_token` into a real `tools/list` call against `/`, confirm it's accepted —
   proving the full loop end-to-end, entirely locally, no real claude.ai involved.

Real end-to-end confirmation still requires the user to actually re-add the connector in claude.ai
and see it succeed — this spec's automated check proves the server-side logic is correct, not
that claude.ai's specific client behavior matches every assumption made here.

## Known residual risk

`/authorize`'s HTML form submits the token over a normal POST to this Supabase Edge Function URL
(HTTPS, so in-transit exposure is not a concern) — but this is the one endpoint in the whole
system that renders a fillable HTML page rather than serving JSON, so it's worth being deliberate
about: no external JS/CSS includes, no tracking, a plain unstyled-or-minimally-styled form is
sufficient and reduces any attack surface on this one page.
