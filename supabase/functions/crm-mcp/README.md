# CRM MCP Connector (remote, for claude.ai)

A Supabase Edge Function exposing the Brisk CRM's data (prospects, deals, campaigns, notes,
workflows, reports) plus a `send_outreach_email` tool as a remote MCP server, so claude.ai can
be registered as a Custom Connector against it. This is the "v2" companion to the local
Claude Code MCP server in `crm-app/mcp-server/` — see
`docs/superpowers/specs/2026-07-17-mcp-connector-v2-design.md` for the full design.

Single-user scope: one shared secret (`CRM_MCP_TOKEN`) is the only credential that matters — the
OAuth 2.1 layer below exists solely because claude.ai's connector flow requires OAuth, not because
this supports per-user login or a multi-tenant team. Authorizing the connector still means typing
in that one shared secret; there's no separate identity system behind it.

## Deploy (Supabase Dashboard — no CLI)

1. Dashboard → Edge Functions → **Deploy a new function**, name it `crm-mcp`.
2. Paste in the contents of every file under `crm-app/supabase/functions/crm-mcp/` (excluding
   `scripts/` and this README — only `index.ts`, `auth.ts`, `jsonRpc.ts`, `supabaseClient.ts`,
   `config.ts`, and `tools/*.ts` are part of the deployed function). Preserve the `tools/`
   subdirectory structure when uploading through the Dashboard editor — those files must stay
   under a `tools/` folder relative to `index.ts`, not be flattened alongside it. Also include
   `deno.json`: it pins the exact dependency versions matching `deno.lock` (the ones this was
   actually tested against). Omitting it still works, since the runtime falls back to resolving
   unpinned versions from the bare `npm:` specifiers, but including it is safer.
3. **Disable JWT verification for this function specifically** (Dashboard → Edge Functions →
   `crm-mcp` → toggle off "Verify JWT"). This function does its own auth check — Supabase's
   default JWT check would otherwise reject claude.ai's requests, since claude.ai sends our own
   bearer secret in that header, not a Supabase-issued JWT.
4. Add secrets (Dashboard → Edge Functions → Secrets):
   - `CRM_MCP_TOKEN` — generate a long random string yourself (this is what you'll paste into
     claude.ai's connector setup).
   - `MCP_CRM_USER_ID` — a real `crm_users.id`, found via
     `select id from crm_users where email = 'you@example.com';` in the SQL Editor.
   - `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — should already exist from the `send-email`/
     `send-campaign-batch` functions; confirm they're present, don't need to re-add them.
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — do **not** add these manually, Supabase
     injects them into every edge function automatically.
5. Note the function's URL: `https://<project-ref>.supabase.co/functions/v1/crm-mcp` (this is
   `SUPABASE_URL` + `/functions/v1/crm-mcp` — the same base URL `oauth.ts`'s `crmMcpBaseUrl()`
   computes internally, so it must match exactly).

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

## Guardrails

Both `activate_campaign` and `send_outreach_email` require `confirm: true` — calling either
without it returns a structured error describing the real-world consequence (emails that would
go out) instead of silently proceeding.

## Local verification (before deploying)

`node scripts/verify-http.mjs` — spawns the function locally via `npx deno run` and exercises
the full JSON-RPC surface with placeholder credentials, confirming the protocol, auth, and every
tool's structured-error behavior without touching a real database or sending a real email.
