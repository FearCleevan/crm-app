# CRM MCP Connector (remote, for claude.ai)

A Supabase Edge Function exposing the Brisk CRM's data (prospects, deals, campaigns, notes,
workflows, reports) plus a `send_outreach_email` tool as a remote MCP server, so claude.ai can
be registered as a Custom Connector against it. This is the "v2" companion to the local
Claude Code MCP server in `crm-app/mcp-server/` — see
`docs/superpowers/specs/2026-07-17-mcp-connector-v2-design.md` for the full design.

Single-user scope: one shared secret authenticates every request. No OAuth, no per-user login —
this connector is meant for one person, not the whole CRM team.

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
5. Note the function's URL: `https://<project-ref>.functions.supabase.co/crm-mcp`.

## Register in claude.ai

1. claude.ai → Settings → Connectors → **Add custom connector**.
2. Paste the function URL from step 5 above.
3. Under **Advanced settings / Request headers**, add a header named `Authorization` with value
   `Bearer <your CRM_MCP_TOKEN value>`.
   - This "Request headers" option is in beta rollout as of mid-2026. If it isn't available in
     your account's connector UI, that's a real scope change (a minimal OAuth flow would be
     needed instead) — don't try to work around its absence silently, treat it as blocking and
     revisit the design.
4. Save, then ask Claude to search for a real prospect to confirm the connection works end to end.

## Guardrails

Both `activate_campaign` and `send_outreach_email` require `confirm: true` — calling either
without it returns a structured error describing the real-world consequence (emails that would
go out) instead of silently proceeding.

## Local verification (before deploying)

`node scripts/verify-http.mjs` — spawns the function locally via `npx deno run` and exercises
the full JSON-RPC surface with placeholder credentials, confirming the protocol, auth, and every
tool's structured-error behavior without touching a real database or sending a real email.
