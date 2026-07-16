# CRM MCP Server — Design Spec

## Problem

There's no way for Claude Code (or, later, an end-user AI assistant) to read or
act on live CRM data (prospects, deals, campaigns, notes, workflows, reports)
without a human pasting SQL results into chat. This spec covers v1: a local
MCP server for the developer's own Claude Code sessions. A future remote,
per-user OAuth connector for end CRM users is an explicitly separate,
out-of-scope v2 project.

## Goals (v1)

- Standalone MCP server, run locally via stdio, registered with `claude mcp add`.
- Full read + write access to the core business entities: prospects, deals,
  campaigns (+ recipients), notes, workflows (read-only), reports (read-only).
- One guardrail: `activate_campaign` requires `confirm: true`, since activating
  a campaign causes real emails to go out via the `dispatch-campaign-batch`
  pg_cron job built in the prior email-automation feature.

## Non-goals (v1)

- No remote/hosted server, no per-user OAuth, no RLS-respecting auth — this
  server uses the Supabase `service_role` key and is meant to be run only by
  the developer, locally.
- No MCP tools for `crm_users` management, API keys/integrations, IP
  whitelist, rate limits, or other security/admin settings — no product
  reason for an AI assistant to touch these, even though the service-role key
  technically could.
- No workflow *execution* trigger tool — there is no workflow execution
  engine in the app yet ([[project_phases]]), so `list_workflows` /
  `get_workflow_runs` are read-only.
- No automated test suite — matches the rest of the project (no
  Jest/Vitest configured anywhere). Verified manually instead.

## Architecture

A new standalone package at `crm-app/mcp-server/`:
- Own `package.json`, own `tsconfig.json` — not part of the Vite app, not
  bundled into the frontend build.
- Own `.env.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — copied
  once from the main app's values, kept separate so the service-role key is
  never loaded by the Vite dev server or bundled client-side.
- Uses `@modelcontextprotocol/sdk`'s stdio server + `@supabase/supabase-js`.
- Registered locally via:
  `claude mcp add crm -- node crm-app/mcp-server/dist/index.js`
  (documented as a one-time setup step in `mcp-server/README.md`, no runtime
  CLI automation).

## Components (tool groups)

One module per entity domain under `mcp-server/src/tools/`:

| Domain | Tools |
|---|---|
| prospects | `search_prospects(query, filters?)`, `get_prospect(id)`, `create_prospect(data)`, `update_prospect(id, data)` |
| deals | `list_deals(stage?, owner?)`, `get_deal(id)`, `update_deal_stage(id, stage)`, `create_deal(data)` |
| campaigns | `list_campaigns(status?)`, `get_campaign(id)`, `create_campaign(data)` (created as `draft`), `activate_campaign(id, confirm: true)` **[guarded]**, `list_campaign_recipients(campaign_id)` |
| notes | `list_notes(prospect_id)`, `add_note(prospect_id, text)` |
| workflows | `list_workflows()`, `get_workflow_runs(id)` (read-only) |
| reports | `get_report(type, date_range)` (read-only, wraps existing dashboard RPCs) |

## Data flow

MCP client (Claude Code) → stdio → `mcp-server` process → `supabase-js`
(service-role key, bypasses RLS) → Postgres → small JSON result mapped back
as the tool response. No caching, no local state — every call hits Supabase
live.

`activate_campaign` sets `email_campaigns.status = 'active'` directly; it does
**not** invoke `send-campaign-batch` itself — the existing
`dispatch-campaign-batch` pg_cron job already picks up any `active` campaign
on its own 15-minute schedule.

## Error handling

- Supabase errors (bad id, constraint violation, etc.) are caught and
  returned as an MCP tool error carrying the underlying Postgres message —
  not swallowed.
- The `confirm` guard on `activate_campaign` is enforced in the tool handler,
  not the database. Without `confirm: true`, it returns a structured error:
  `"Activating this campaign will start sending real emails to N pending
  recipients. Re-call with confirm: true to proceed."`
- No retries, no queuing. If Supabase is unreachable, the tool call fails —
  this is a local dev tool, not a production integration path.

## Testing / verification

No automated test suite (consistent with the rest of the project). Verified
manually: register the server with `claude mcp add`, then exercise each tool
once from a real Claude Code session against real (or scratch) data —
following the same "test live against the real DB" pattern used for the
campaign-frontend-wiring QA pass.

## Future (explicitly out of scope here)

- v2: remote, hosted MCP server with per-CRM-user OAuth, respecting existing
  RLS/`crm_users` permissions, for end users to connect via claude.ai —
  separate spec, separate build.
