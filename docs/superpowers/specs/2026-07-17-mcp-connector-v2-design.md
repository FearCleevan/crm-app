# CRM MCP Connector v2 — Remote claude.ai Custom Connector — Design Spec

## Problem

v1 (shipped, merged to `main` at `a6cb9a5`) is a local, stdio-based MCP server that only
Claude Code, running on the developer's own machine, can reach. It cannot help with the
user's actual goal: connecting **claude.ai** itself (not Claude Code) to the CRM, so Claude can
browse/search prospects and draft + send outreach emails directly, without a human relaying data
back and forth. That requires a server reachable over a public HTTPS URL — an entirely different
transport and hosting story than v1, which is why the v1 spec explicitly scoped this out as a
separate v2 project.

## Goals (v2)

- A new Supabase Edge Function, `crm-mcp`, implementing the MCP "Streamable HTTP" transport,
  reachable at a public HTTPS URL registered as a claude.ai Custom Connector.
- Single-user auth: one shared bearer secret (stored in Supabase Edge Function Secrets),
  checked by the function itself on every request. No OAuth flow, no per-user login — this
  connector is for one person (the CRM's developer/owner), not the whole `crm_users` team.
- Full parity with v1's 18 tools (prospects, deals, campaigns, notes, workflows, reports),
  reimplemented in Deno for the edge-function runtime.
- One new tool not present in v1: `send_outreach_email(prospect_id, subject, body, confirm: true)`
  — sends a single email immediately (via the same Resend-calling pattern as the existing
  `send-email` edge function), without needing to create/activate a whole campaign for a
  one-off outreach message.
- Two guarded tools requiring `confirm: true`: `activate_campaign` (carried over from v1 —
  activating a campaign causes real batched emails via the existing `dispatch-campaign-batch`
  pg_cron job) and `send_outreach_email` (new — sends one real email immediately, with no cron
  delay to catch a mistake, so the guard matters at least as much here).

## Non-goals (v2)

- No OAuth 2.1 flow, no per-user token issuance, no mapping to individual `crm_users` — this is
  explicitly the "just me" scope, not the "whole team" scope that was also considered and
  declined for this build.
- No new tools beyond the v1 parity set plus `send_outreach_email` — no workflow-execution
  trigger, no `crm_users`/API-keys/IP-whitelist/rate-limit exposure (same exclusions as v1, for
  the same reasons: no product justification for an AI assistant to touch security/admin
  config, even though the service-role key technically could).
- No shared code module between v1 (`mcp-server/`, Node) and v2 (`crm-mcp`, Deno edge function)
  — tool logic is intentionally duplicated, matching how this project already duplicates
  Resend-calling logic between `send-email` and `send-campaign-batch` rather than introducing a
  cross-runtime shared library for a handful of functions.
- No automated test suite (matches v1 and the rest of the project). Verified manually instead.

## Architecture

A new edge function at `crm-app/supabase/functions/crm-mcp/`, deployed via the Supabase
Dashboard (no CLI, per project convention) with **JWT verification disabled** for this specific
function — Supabase edge functions check for a valid Supabase-issued JWT on the `Authorization`
header by default, which would reject claude.ai's connector request (it sends our own bearer
secret, not a Supabase JWT). This is the same accommodation `resend-webhook` already needs, since
Resend can't send a Supabase JWT either.

The function itself checks every incoming request's bearer token against a single secret stored
in Supabase Edge Function Secrets (e.g. `CRM_MCP_TOKEN`) before doing anything else — a
mismatched or missing token returns 401 immediately, no tool logic runs.

It implements the MCP "Streamable HTTP" transport: a single POST endpoint handling JSON-RPC
`initialize`, `tools/list`, and `tools/call`, built on `Deno.serve`'s fetch-style
`Request`/`Response` API. **Open implementation question, to resolve as an early build step, not
here:** the `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` class is built around
Node's `http.Server` request/response objects, which may not plug directly into Deno's
fetch-style handler. The plan should try wiring the SDK's transport class into `Deno.serve`
first; if that doesn't fit, fall back to hand-rolling the small slice of JSON-RPC the three
methods actually need directly against `Request`/`Response`, without the SDK's server transport
layer.

Tool handlers use `@supabase/supabase-js` with the service-role key (same access pattern as v1
and every other edge function in this project) — bypasses RLS, matches the "just me" single-user
scope.

## Components (tools)

Same 18 tools as v1 (see v1's design spec, `2026-07-16-mcp-server-design.md`, for the full table
of names/schemas — unchanged here), reimplemented in Deno, plus one new tool:

| Domain | Tools |
|---|---|
| prospects | `search_prospects`, `get_prospect`, `create_prospect`, `update_prospect` |
| deals | `list_deals`, `get_deal`, `update_deal_stage`, `create_deal` |
| campaigns | `list_campaigns`, `get_campaign`, `create_campaign`, `activate_campaign` **[guarded]**, `list_campaign_recipients` |
| notes | `list_notes`, `add_note` |
| workflows | `list_workflows`, `get_workflow_runs` (read-only) |
| reports | `get_report` |
| outreach (new) | `send_outreach_email(prospect_id, subject, body, confirm: true)` **[guarded]** |

`send_outreach_email` looks up the prospect's email, sends via the same Resend API call pattern
as `send-email`, and logs an `activities` row on success — mirroring `send-email`'s existing
behavior rather than inventing a new logging convention.

## Data flow

claude.ai → HTTPS POST to the `crm-mcp` function URL → bearer-token check (401 if it fails) →
JSON-RPC method dispatch (`initialize` / `tools/list` / `tools/call`) → tool handler →
`supabase-js` (service-role) for DB tools, or a direct Resend API call + `activities` insert for
`send_outreach_email`. Stateless: no session or connection reuse between requests, since this is
an edge function, not a long-lived process like v1's local stdio server.

## Error handling

- Bearer-token mismatch or missing header: 401, before any tool logic executes.
- Every Supabase/Resend error inside a tool handler returns a structured MCP tool error
  (`isError: true` with the underlying message) — never an unhandled 500 with no body, matching
  v1's convention.
- Both guarded tools (`activate_campaign`, `send_outreach_email`) enforce `confirm: true` in the
  handler itself, not the database — identical pattern to v1's `activate_campaign`.

## Testing / verification

No automated test suite (matches v1 and the rest of the project). Verification path:
1. Deploy via the Supabase Dashboard.
2. `curl` the function URL directly with a raw JSON-RPC `tools/list` POST (bearer token in the
   header) to confirm the transport and auth work, before touching claude.ai's connector UI at
   all — cheaper and faster to debug than round-tripping through the actual connector setup for
   every iteration.
3. Register the real connector in claude.ai (Custom Connector → the function URL → Advanced
   settings/Request headers → the bearer secret) and do one real end-to-end check: ask Claude to
   search a prospect and send a real test outreach email to yourself.

## Known external-platform risk

claude.ai's "Request headers" fixed-credential auth option (the mechanism this design relies on
for single-user bearer-token auth without OAuth) is documented as being in **beta, rolled out
gradually** as of this writing (verified via web search during brainstorming, not from training
data). If the option isn't available in your account's connector UI when you get to registering
it, the fallback is a minimal OAuth 2.1 flow (a fixed client, always issuing the same single
token to whoever authorizes) — a real scope increase, not a small tweak, so flag it immediately
if the Request-headers option turns out to be unavailable rather than trying to work around it
silently.

## Future (out of scope here)

- A "whole team" version (per-`crm_users` OAuth, respecting existing RLS/permissions) was
  considered and explicitly declined for this build — a separate spec if ever needed.
