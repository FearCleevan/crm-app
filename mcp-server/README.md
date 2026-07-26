# CRM MCP Server (local dev connector)

A local, stdio-based MCP server exposing Paul CRM's core data
(prospects, deals, campaigns, notes, workflows, reports) as tools for
Claude Code. Local-only — uses the Supabase `service_role` key, bypasses
RLS, and is meant to be run by one developer on their own machine.

See `docs/superpowers/specs/2026-07-16-mcp-server-design.md` for the full
design, including what's explicitly out of scope (no remote/OAuth
connector, no admin/security tools, no workflow execution trigger).

## Setup

1. `cd crm-app/mcp-server && npm install`
2. `cp .env.local.example .env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard →
     Project Settings → API.
   - `MCP_CRM_USER_ID` — a real `crm_users.id`, found via
     `select id from crm_users where email = 'you@example.com';` in the
     SQL Editor. Used to attribute campaign/note creation.
3. `npm run build`
4. Register with Claude Code:
   `claude mcp add crm -- node crm-app/mcp-server/dist/index.js`

## Guardrails

`activate_campaign` requires `confirm: true` — calling it without that
returns an error describing how many pending recipients would receive a
real email, rather than silently activating the campaign.

## Manual verification

`npx @modelcontextprotocol/inspector node dist/index.js` — opens a local
browser UI to call any tool directly without going through Claude Code.
