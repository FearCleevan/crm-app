# CRM MCP Connector v2 (Remote claude.ai Custom Connector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Supabase Edge Function, `crm-mcp`, exposing the CRM's 18 v1 tools plus a new `send_outreach_email` tool over the MCP-over-HTTP protocol, so claude.ai can be registered as a Custom Connector against it.

**Architecture:** A single Deno edge function at `crm-app/supabase/functions/crm-mcp/`. It hand-rolls the JSON-RPC dispatch (`initialize`, `tools/list`, `tools/call`) directly against Deno's fetch-style `Request`/`Response` — the `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` is built around Node's `http.IncomingMessage`/`http.ServerResponse`, which is a different object model than Deno's fetch API, so this plan does not attempt to force that class into `Deno.serve`. Tool definitions live in an array-of-objects registry (`{name, description, schema, handler}`), converted to JSON Schema for `tools/list` via `zod-to-json-schema`, imported through Deno's `npm:` specifier support. Every request is gated by a single shared bearer-token check before any JSON-RPC handling runs.

**Tech Stack:** Deno (Supabase Edge Functions runtime — confirmed locally runnable via `npx deno`, no separate install needed), `npm:@supabase/supabase-js@2`, `npm:zod@4`, `npm:zod-to-json-schema@3`.

## Global Constraints

- Single shared bearer secret (`CRM_MCP_TOKEN`, a Supabase Edge Function Secret) checked on every request — no OAuth, no per-user auth (spec: single-user "just me" scope).
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into every Supabase Edge Function by the platform itself — do not add them as manual secrets, and do not require the local test harness to fake anything but their presence as plain env vars.
- JWT verification must be disabled for this function at the platform level (Dashboard toggle) — it is not something this code can control, must be documented as a deploy step.
- No tools beyond v1's 18 plus `send_outreach_email` (spec non-goal: no `crm_users`/API-keys/IP-whitelist/rate-limit tools, no workflow execution trigger).
- Both `activate_campaign` and `send_outreach_email` require `confirm: true`, enforced in the handler, not the database (spec goal).
- No automated test suite (matches v1 and the rest of the project). Verification is a real, local, protocol-level check per task: spawn the Deno server locally via `npx deno run`, hit it with real HTTP requests from a Node test script (mirroring v1's `verify-handshake.mjs` pattern, adapted for raw HTTP + auth instead of the MCP SDK client), using placeholder Supabase/Resend credentials — same "structured error, not a crash" bar as v1.
- No CLI deploy instructions in the README/Task 10 — Supabase Dashboard only (project convention).

---

## File Structure

```
crm-app/supabase/functions/crm-mcp/
  index.ts              — Deno.serve entrypoint: CORS, auth check, JSON-RPC dispatch
  auth.ts                — bearer-token check
  jsonRpc.ts              — CORS header + JSON-RPC result/error response helpers
  supabaseClient.ts        — Supabase client from Deno.env
  config.ts                — MCP_CRM_USER_ID from Deno.env
  tools/
    types.ts               — ToolDef / ToolResult interfaces
    registry.ts             — combines every domain's tools into one TOOLS array
    prospects.ts
    deals.ts
    campaigns.ts
    notes.ts
    workflows.ts
    reports.ts
    outreach.ts             — new: send_outreach_email
  scripts/
    verify-http.mjs         — Node test harness, spawns the Deno server locally and hits it with real HTTP requests
  README.md
```

---

### Task 1: Scaffold — auth, JSON-RPC dispatch, empty tool registry

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/jsonRpc.ts`
- Create: `crm-app/supabase/functions/crm-mcp/auth.ts`
- Create: `crm-app/supabase/functions/crm-mcp/supabaseClient.ts`
- Create: `crm-app/supabase/functions/crm-mcp/config.ts`
- Create: `crm-app/supabase/functions/crm-mcp/tools/types.ts`
- Create: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`
- Create: `crm-app/supabase/functions/crm-mcp/index.ts`
- Create: `crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs`

**Interfaces:**
- Produces: `CORS` (object), `jsonRpcResult(id, result)`, `jsonRpcError(id, code, message)` from `jsonRpc.ts` — used by `index.ts` in every task.
- Produces: `checkAuth(req: Request): boolean` from `auth.ts` — used by `index.ts` only.
- Produces: `supabase` (SupabaseClient instance) from `supabaseClient.ts` — used by every `tools/*.ts` file from Task 2 onward.
- Produces: `MCP_CRM_USER_ID: string | null` from `config.ts` — used by `campaigns.ts`, `notes.ts`, `outreach.ts`.
- Produces: `ToolDef` / `ToolResult` interfaces from `tools/types.ts` — every `tools/*.ts` file implements `ToolDef[]`.
- Produces: `TOOLS: ToolDef[]` from `tools/registry.ts` (empty array in this task) — `index.ts` reads it for `tools/list`/`tools/call`. Later tasks append their domain's tools to this array.

- [ ] **Step 1: Write `jsonRpc.ts`**

```typescript
export const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonRpcResult(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export function jsonRpcError(id: unknown, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Write `auth.ts`**

```typescript
export function checkAuth(req: Request): boolean {
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected) return false
  return req.headers.get('Authorization') === `Bearer ${expected}`
}
```

- [ ] **Step 3: Write `supabaseClient.ts`**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

export const supabase = createClient(url, key)
```

- [ ] **Step 4: Write `config.ts`**

```typescript
export const MCP_CRM_USER_ID: string | null = Deno.env.get('MCP_CRM_USER_ID') ?? null
```

- [ ] **Step 5: Write `tools/types.ts`**

```typescript
import type { z } from 'npm:zod@4'

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

export interface ToolDef {
  name: string
  description: string
  schema: Record<string, z.ZodTypeAny>
  handler: (args: any) => Promise<ToolResult>
}
```

- [ ] **Step 6: Write `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'

export const TOOLS: ToolDef[] = []
```

- [ ] **Step 7: Write `index.ts`**

```typescript
import { z } from 'npm:zod@4'
import { zodToJsonSchema } from 'npm:zod-to-json-schema@3'
import { CORS, jsonRpcResult, jsonRpcError } from './jsonRpc.ts'
import { checkAuth } from './auth.ts'
import { TOOLS } from './tools/registry.ts'

const SERVER_INFO = { name: 'crm-mcp', version: '0.1.0' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  if (!checkAuth(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let rpc: { jsonrpc?: string; id?: unknown; method?: string; params?: any }
  try {
    rpc = await req.json()
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  const { id, method, params } = rpc

  // JSON-RPC notifications (no id) never get a response body.
  if (id === undefined) {
    return new Response(null, { status: 202, headers: CORS })
  }

  switch (method) {
    case 'initialize': {
      return jsonRpcResult(id, {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      })
    }
    case 'tools/list': {
      return jsonRpcResult(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: zodToJsonSchema(z.object(t.schema)),
        })),
      })
    }
    case 'tools/call': {
      const toolName = params?.name
      const tool = TOOLS.find((t) => t.name === toolName)
      if (!tool) return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`)

      const parsed = z.object(tool.schema).safeParse(params?.arguments ?? {})
      if (!parsed.success) {
        return jsonRpcResult(id, {
          content: [{ type: 'text', text: `Error: invalid arguments: ${parsed.error.message}` }],
          isError: true,
        })
      }

      const result = await tool.handler(parsed.data)
      return jsonRpcResult(id, result)
    }
    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`)
  }
})
```

- [ ] **Step 8: Write `scripts/verify-http.mjs`**

```javascript
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FUNCTION_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_URL = 'http://localhost:8000'
const TEST_TOKEN = 'test-token-123'

const env = {
  ...process.env,
  CRM_MCP_TOKEN: TEST_TOKEN,
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-key',
  MCP_CRM_USER_ID: '00000000-0000-0000-0000-000000000000',
}

const proc = spawn('npx', ['deno', 'run', '--allow-net', '--allow-env', 'index.ts'], {
  cwd: FUNCTION_DIR,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
})

proc.stderr.on('data', (d) => process.stderr.write(d))

async function waitForReady(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE_URL, { method: 'OPTIONS' })
      if (res.status === 200) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Server did not become ready in time')
}

async function rpc(method, params, id = 1, token = TEST_TOKEN) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function main() {
  await waitForReady()

  console.log('=== No auth header (expect 401) ===')
  const noAuthRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  })
  console.log('status:', noAuthRes.status)
  if (noAuthRes.status !== 401) throw new Error('expected 401 with no auth header')

  console.log('=== Wrong token (expect 401) ===')
  const wrongRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  })
  console.log('status:', wrongRes.status)
  if (wrongRes.status !== 401) throw new Error('expected 401 with wrong token')

  console.log('=== initialize (expect 200, serverInfo) ===')
  const init = await rpc('initialize', { protocolVersion: '2025-06-18' })
  console.log(JSON.stringify(init, null, 2))
  if (init.body?.result?.serverInfo?.name !== 'crm-mcp') throw new Error('unexpected serverInfo')

  console.log('=== tools/list (expect empty array at this stage) ===')
  const list = await rpc('tools/list', {}, 2)
  console.log(JSON.stringify(list.body.result.tools, null, 2))

  console.log('ALL CHECKS PASSED')
  proc.kill()
  process.exit(0)
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  proc.kill()
  process.exit(1)
})
```

- [ ] **Step 9: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: prints all four `===` sections, ends with `ALL CHECKS PASSED`, exit code 0. The two auth checks must show `status: 401`. `tools/list` shows `[]` (empty — no tools registered yet, correct at this stage).

- [ ] **Step 10: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/jsonRpc.ts crm-app/supabase/functions/crm-mcp/auth.ts crm-app/supabase/functions/crm-mcp/supabaseClient.ts crm-app/supabase/functions/crm-mcp/config.ts crm-app/supabase/functions/crm-mcp/tools/types.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/index.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): scaffold auth, JSON-RPC dispatch, empty tool registry"
```

---

### Task 2: Prospect tools

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/tools/prospects.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.ts`, `ToolDef` from `./types.ts`.
- Produces: `prospectTools: ToolDef[]`, imported and spread into `TOOLS` by `registry.ts`.

- [ ] **Step 1: Write `tools/prospects.ts`**

```typescript
import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import type { ToolDef } from './types.ts'

const PROSPECT_COLUMNS =
  'id, fullname, firstname, lastname, email, company, jobtitle, city, state, country, status, created_on'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const prospectTools: ToolDef[] = [
  {
    name: 'search_prospects',
    description: 'Search prospects by name, email, or company (case-insensitive partial match)',
    schema: {
      query: z.string().min(1).describe('Search term matched against full name, email, and company'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    handler: async ({ query, limit }) => {
      const sanitized = query.replace(/[(),]/g, '')
      const { data, error } = await supabase
        .from('prospects')
        .select(PROSPECT_COLUMNS)
        .or(`fullname.ilike.%${sanitized}%,email.ilike.%${sanitized}%,company.ilike.%${sanitized}%`)
        .limit(limit)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'get_prospect',
    description: 'Get a single prospect by id',
    schema: { id: z.number().int() },
    handler: async ({ id }) => {
      const { data, error } = await supabase.from('prospects').select('*').eq('id', id).maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No prospect found with id ${id}`)
      return jsonResult(data)
    },
  },
  {
    name: 'create_prospect',
    description: 'Create a new prospect',
    schema: {
      firstname: z.string().min(1),
      lastname: z.string().min(1),
      email: z.string().email(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).default('New'),
    },
    handler: async ({ firstname, lastname, email, company, jobtitle, status }) => {
      const { data, error } = await supabase
        .from('prospects')
        .insert({
          firstname,
          lastname,
          fullname: `${firstname} ${lastname}`,
          email,
          company: company ?? null,
          jobtitle: jobtitle ?? null,
          status,
        })
        .select(PROSPECT_COLUMNS)
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'update_prospect',
    description: 'Update fields on an existing prospect',
    schema: {
      id: z.number().int(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).optional(),
    },
    handler: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('prospects')
        .update({ ...updates, updated_on: new Date().toISOString() })
        .eq('id', id)
        .select(PROSPECT_COLUMNS)
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No prospect found with id ${id}`)
      return jsonResult(data)
    },
  },
]
```

- [ ] **Step 2: Update `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'

export const TOOLS: ToolDef[] = [...prospectTools]
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

Add before `proc.kill()` in `main()`:

```javascript
  console.log('=== tools/list (expect 4 prospect tools) ===')
  const list2 = await rpc('tools/list', {}, 3)
  const names = list2.body.result.tools.map((t) => t.name)
  console.log(names)
  for (const expected of ['search_prospects', 'get_prospect', 'create_prospect', 'update_prospect']) {
    if (!names.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: search_prospects (expect isError, placeholder credentials) ===')
  const callRes = await rpc(
    'tools/call',
    { name: 'search_prospects', arguments: { query: 'a', limit: 5 } },
    4,
  )
  console.log(JSON.stringify(callRes.body, null, 2))
  if (callRes.body?.result?.isError !== true) throw new Error('expected isError:true from search_prospects')
```

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks still pass, plus the 4 prospect tools are listed by name, and `search_prospects` returns `isError: true` (a network/DNS failure against the placeholder Supabase URL, not a crash). Ends with `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/tools/prospects.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add prospect tools"
```

---

### Task 3: Deal tools

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/tools/deals.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.ts`, `ToolDef` from `./types.ts`.
- Produces: `dealTools: ToolDef[]`.

- [ ] **Step 1: Write `tools/deals.ts`**

```typescript
import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import type { ToolDef } from './types.ts'

const DEAL_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
] as const

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const dealTools: ToolDef[] = [
  {
    name: 'list_deals',
    description: 'List deals, optionally filtered by pipeline stage',
    schema: { stage: z.enum(DEAL_STAGES).optional(), limit: z.number().int().min(1).max(200).default(50) },
    handler: async ({ stage, limit }) => {
      let q = supabase
        .from('deals')
        .select('id, name, prospect_name, company, stage, value, probability, expected_close_date')
        .order('sort_order', { ascending: true })
        .limit(limit)
      if (stage) q = q.eq('stage', stage)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'get_deal',
    description: 'Get a single deal by id',
    schema: { id: z.string().uuid() },
    handler: async ({ id }) => {
      const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No deal found with id ${id}`)
      return jsonResult(data)
    },
  },
  {
    name: 'update_deal_stage',
    description: 'Move a deal to a different pipeline stage',
    schema: { id: z.string().uuid(), stage: z.enum(DEAL_STAGES) },
    handler: async ({ id, stage }) => {
      const { data, error } = await supabase
        .from('deals')
        .update({ stage, stage_changed_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, name, stage')
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No deal found with id ${id}`)
      return jsonResult(data)
    },
  },
  {
    name: 'create_deal',
    description: 'Create a new deal',
    schema: {
      name: z.string().min(1),
      prospect_name: z.string().default(''),
      company: z.string().default(''),
      stage: z.enum(DEAL_STAGES).default('New Lead'),
      value: z.number().default(0),
      probability: z.number().int().min(0).max(100).default(10),
      expected_close_date: z.string().describe('YYYY-MM-DD').optional(),
    },
    handler: async ({ name, prospect_name, company, stage, value, probability, expected_close_date }) => {
      const { data, error } = await supabase
        .from('deals')
        .insert({
          name,
          prospect_name,
          company,
          stage,
          value,
          probability,
          ...(expected_close_date ? { expected_close_date } : {}),
        })
        .select('id, name, stage, value')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
]
```

- [ ] **Step 2: Update `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'

export const TOOLS: ToolDef[] = [...prospectTools, ...dealTools]
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

Add to the tool-name check array and add a deal call check:

```javascript
  for (const expected of ['list_deals', 'get_deal', 'update_deal_stage', 'create_deal']) {
    if (!names.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: list_deals (expect isError, placeholder credentials) ===')
  const dealsCall = await rpc('tools/call', { name: 'list_deals', arguments: {} }, 5)
  console.log(JSON.stringify(dealsCall.body, null, 2))
  if (dealsCall.body?.result?.isError !== true) throw new Error('expected isError:true from list_deals')
```

(Append these lines into the same `main()` function, after the prospects section from Task 2, before `console.log('ALL CHECKS PASSED')`.)

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, plus the 4 deal tools are listed and `list_deals` returns `isError: true`.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/tools/deals.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add deal tools"
```

---

### Task 4: Campaign tools (with guarded `activate_campaign`)

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/tools/campaigns.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.ts`, `MCP_CRM_USER_ID` from `../config.ts`, `ToolDef` from `./types.ts`.
- Produces: `campaignTools: ToolDef[]`.

This ports v1's `activate_campaign` **as it exists today** (already hardened by v1's final review: id echoed in the confirm message, `count === null` treated as an error rather than silently showing 0, and a status check refusing to re-activate an already-active/completed campaign).

- [ ] **Step 1: Write `tools/campaigns.ts`**

```typescript
import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import { MCP_CRM_USER_ID } from '../config.ts'
import type { ToolDef } from './types.ts'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const campaignTools: ToolDef[] = [
  {
    name: 'list_campaigns',
    description: 'List email campaigns, optionally filtered by status',
    schema: { status: z.enum(['draft', 'active', 'paused', 'completed']).optional() },
    handler: async ({ status }) => {
      let q = supabase
        .from('email_campaigns')
        .select('id, name, status, daily_limit, total_recipients, total_sent, created_at')
        .order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'get_campaign',
    description: 'Get a single campaign by id',
    schema: { id: z.string().uuid() },
    handler: async ({ id }) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*, email_templates(name, subject)')
        .eq('id', id)
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No campaign found with id ${id}`)
      return jsonResult(data)
    },
  },
  {
    name: 'create_campaign',
    description: 'Create a new email campaign (status starts as draft)',
    schema: {
      name: z.string().min(1),
      description: z.string().optional(),
      template_id: z.string().uuid().optional(),
      daily_limit: z.number().int().min(10).max(500).default(50),
    },
    handler: async ({ name, description, template_id, daily_limit }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in Supabase Edge Function Secrets — set it to a real crm_users.id before creating campaigns.',
        )
      }
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: MCP_CRM_USER_ID,
          name,
          description: description ?? null,
          template_id: template_id ?? null,
          daily_limit,
        })
        .select('id, name, status')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'activate_campaign',
    description:
      'Activate a draft/paused campaign so it starts sending real emails via the dispatch-campaign-batch cron job. Requires confirm: true.',
    schema: { id: z.string().uuid(), confirm: z.boolean().default(false) },
    handler: async ({ id, confirm }) => {
      const { count, error: countErr } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('status', 'pending')
      if (countErr) return errorResult(countErr.message)
      if (count === null) {
        return errorResult(
          `Could not determine the number of pending recipients for campaign ${id} ` +
            `(count query returned null). Refusing to proceed with activation until this can be verified.`,
        )
      }

      if (!confirm) {
        return errorResult(
          `Activating campaign ${id} will start sending real emails to ${count} pending recipients ` +
            `(picked up by the dispatch-campaign-batch cron job within 15 minutes). Re-call with confirm: true to proceed.`,
        )
      }

      const { data: existing, error: fetchErr } = await supabase
        .from('email_campaigns')
        .select('id, status')
        .eq('id', id)
        .maybeSingle()
      if (fetchErr) return errorResult(fetchErr.message)
      if (!existing) return errorResult(`No campaign found with id ${id}`)
      if (existing.status === 'active' || existing.status === 'completed') {
        return errorResult(
          `Campaign ${id} is already "${existing.status}" — refusing to re-activate. ` +
            `Only draft or paused campaigns can be activated.`,
        )
      }

      const { data, error } = await supabase
        .from('email_campaigns')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, name, status')
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No campaign found with id ${id}`)
      return jsonResult(data)
    },
  },
  {
    name: 'list_campaign_recipients',
    description: 'List the recipients of a campaign and their send status',
    schema: { campaign_id: z.string().uuid() },
    handler: async ({ campaign_id }) => {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('id, prospect_id, status, sent_at, opened_at, clicked_at, replied_at, bounced_at')
        .eq('campaign_id', campaign_id)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
]
```

- [ ] **Step 2: Update `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'
import { campaignTools } from './campaigns.ts'

export const TOOLS: ToolDef[] = [...prospectTools, ...dealTools, ...campaignTools]
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

Add tool-name checks and an explicit guardrail check (the most important check in this task):

```javascript
  for (const expected of [
    'list_campaigns', 'get_campaign', 'create_campaign', 'activate_campaign', 'list_campaign_recipients',
  ]) {
    if (!names.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: activate_campaign WITHOUT confirm (MOST IMPORTANT CHECK) ===')
  const noConfirm = await rpc(
    'tools/call',
    { name: 'activate_campaign', arguments: { id: '00000000-0000-0000-0000-000000000001', confirm: false } },
    6,
  )
  console.log(JSON.stringify(noConfirm.body, null, 2))
  if (noConfirm.body?.result?.isError !== true) throw new Error('activate_campaign without confirm did not return isError:true')
  if (JSON.stringify(noConfirm.body).includes('"status":"active"')) {
    throw new Error('activate_campaign without confirm appears to have activated something')
  }
```

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, the 5 campaign tools are listed, and `activate_campaign` called without `confirm: true` returns `isError: true` with no evidence of activation (the count query itself fails first against the placeholder credentials — same expected behavior as v1's equivalent check).

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/tools/campaigns.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add campaign tools with guarded activate_campaign"
```

---

### Task 5: Notes tools

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/tools/notes.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.ts`, `MCP_CRM_USER_ID` from `../config.ts`, `ToolDef` from `./types.ts`.
- Produces: `noteTools: ToolDef[]`.

- [ ] **Step 1: Write `tools/notes.ts`**

```typescript
import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import { MCP_CRM_USER_ID } from '../config.ts'
import type { ToolDef } from './types.ts'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const noteTools: ToolDef[] = [
  {
    name: 'list_notes',
    description: 'List notes attached to a prospect (notes are stored as activities with type=note)',
    schema: { prospect_id: z.number().int() },
    handler: async ({ prospect_id }) => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, title, description, created_by, created_at')
        .eq('type', 'note')
        .eq('prospect_id', prospect_id)
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'add_note',
    description: 'Add a note to a prospect',
    schema: { prospect_id: z.number().int(), title: z.string().min(1), description: z.string().optional() },
    handler: async ({ prospect_id, title, description }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in Supabase Edge Function Secrets — set it before adding notes, so notes are attributed correctly instead of silently written with created_by: null.',
        )
      }
      const { data, error } = await supabase
        .from('activities')
        .insert({
          type: 'note',
          title,
          description: description ?? null,
          prospect_id,
          created_by: MCP_CRM_USER_ID,
        })
        .select('id, title, description, created_at')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
]
```

- [ ] **Step 2: Update `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'
import { campaignTools } from './campaigns.ts'
import { noteTools } from './notes.ts'

export const TOOLS: ToolDef[] = [...prospectTools, ...dealTools, ...campaignTools, ...noteTools]
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

```javascript
  for (const expected of ['list_notes', 'add_note']) {
    if (!names.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: list_notes (expect isError, placeholder credentials) ===')
  const notesCall = await rpc('tools/call', { name: 'list_notes', arguments: { prospect_id: 1 } }, 7)
  console.log(JSON.stringify(notesCall.body, null, 2))
  if (notesCall.body?.result?.isError !== true) throw new Error('expected isError:true from list_notes')
```

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, plus the 2 note tools are listed and `list_notes` returns `isError: true`.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/tools/notes.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add notes tools"
```

---

### Task 6: Workflow tools (read-only)

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/tools/workflows.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.ts`, `ToolDef` from `./types.ts`.
- Produces: `workflowTools: ToolDef[]`.

- [ ] **Step 1: Write `tools/workflows.ts`**

```typescript
import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import type { ToolDef } from './types.ts'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const workflowTools: ToolDef[] = [
  {
    name: 'list_workflows',
    description: 'List all workflows (read-only — there is no execution engine to trigger runs yet)',
    schema: {},
    handler: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, description, status, trigger, run_count, last_run')
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'get_workflow_runs',
    description: 'Get the run log for a single workflow',
    schema: { workflow_id: z.string().uuid() },
    handler: async ({ workflow_id }) => {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('id, status, record_label, record_link, duration, error, created_at')
        .eq('workflow_id', workflow_id)
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
]
```

- [ ] **Step 2: Update `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'
import { campaignTools } from './campaigns.ts'
import { noteTools } from './notes.ts'
import { workflowTools } from './workflows.ts'

export const TOOLS: ToolDef[] = [
  ...prospectTools,
  ...dealTools,
  ...campaignTools,
  ...noteTools,
  ...workflowTools,
]
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

```javascript
  for (const expected of ['list_workflows', 'get_workflow_runs']) {
    if (!names.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: list_workflows (expect isError, placeholder credentials) ===')
  const workflowsCall = await rpc('tools/call', { name: 'list_workflows', arguments: {} }, 8)
  console.log(JSON.stringify(workflowsCall.body, null, 2))
  if (workflowsCall.body?.result?.isError !== true) throw new Error('expected isError:true from list_workflows')
```

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, plus the 2 workflow tools are listed and `list_workflows` returns `isError: true`.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/tools/workflows.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add read-only workflow tools"
```

---

### Task 7: Reports tool

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/tools/reports.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.ts`, `ToolDef` from `./types.ts`.
- Produces: `reportTools: ToolDef[]`.

- [ ] **Step 1: Write `tools/reports.ts`**

```typescript
import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import type { ToolDef } from './types.ts'

const REPORT_TYPES = [
  'dashboard_metrics',
  'revenue_by_month',
  'leads_breakdown',
  'conversion_funnel',
  'activity_breakdown',
] as const

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function getDateFrom(range: '7d' | '30d' | 'month' | 'quarter' | 'year'): string {
  const now = new Date()
  switch (range) {
    case '7d':      return new Date(Date.now() - 7 * 86_400_000).toISOString()
    case '30d':     return new Date(Date.now() - 30 * 86_400_000).toISOString()
    case 'month':   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString()
    case 'year':    return new Date(now.getFullYear(), 0, 1).toISOString()
  }
}

export const reportTools: ToolDef[] = [
  {
    name: 'get_report',
    description:
      'Get one of the CRM dashboard reports: dashboard_metrics, revenue_by_month, leads_breakdown, conversion_funnel, activity_breakdown',
    schema: {
      type: z.enum(REPORT_TYPES),
      date_range: z.enum(['7d', '30d', 'month', 'quarter', 'year']).default('30d'),
    },
    handler: async ({ type, date_range }) => {
      const dateFrom = getDateFrom(date_range)
      switch (type) {
        case 'dashboard_metrics': {
          const { data, error } = await supabase.rpc('get_dashboard_metrics')
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'revenue_by_month': {
          const { data, error } = await supabase.rpc('get_revenue_by_month', { months_back: 12 })
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'leads_breakdown': {
          const { data, error } = await supabase.rpc('get_leads_breakdown')
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'conversion_funnel': {
          const { data, error } = await supabase.rpc('get_conversion_funnel', { date_from: dateFrom })
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'activity_breakdown': {
          const { data, error } = await supabase.rpc('get_activity_breakdown', { date_from: dateFrom })
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
      }
    },
  },
]
```

- [ ] **Step 2: Update `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'
import { campaignTools } from './campaigns.ts'
import { noteTools } from './notes.ts'
import { workflowTools } from './workflows.ts'
import { reportTools } from './reports.ts'

export const TOOLS: ToolDef[] = [
  ...prospectTools,
  ...dealTools,
  ...campaignTools,
  ...noteTools,
  ...workflowTools,
  ...reportTools,
]
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

```javascript
  if (!names.includes('get_report')) throw new Error('missing tool: get_report')

  console.log('=== tools/call: get_report type=dashboard_metrics (expect isError, placeholder credentials) ===')
  const reportCall = await rpc(
    'tools/call',
    { name: 'get_report', arguments: { type: 'dashboard_metrics' } },
    9,
  )
  console.log(JSON.stringify(reportCall.body, null, 2))
  if (reportCall.body?.result?.isError !== true) throw new Error('expected isError:true from get_report')
```

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, `get_report` is listed, and calling it with `dashboard_metrics` returns `isError: true`.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/tools/reports.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add reports tool"
```

---

### Task 8: Outreach tool (new — `send_outreach_email`, guarded)

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/tools/outreach.ts`
- Modify: `crm-app/supabase/functions/crm-mcp/tools/registry.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.ts`, `MCP_CRM_USER_ID` from `../config.ts`, `ToolDef` from `./types.ts`.
- Produces: `outreachTools: ToolDef[]`.

This is the one tool not present in v1 — sends a single email immediately (unlike the campaign
tools, which require creating and activating a whole campaign). Mirrors the existing
`send-email` edge function's Resend-calling pattern (`crm-app/supabase/functions/send-email/index.ts`),
adapted to take a `prospect_id` instead of a raw `to` address, and to use `MCP_CRM_USER_ID` for
`activities.created_by` instead of a caller's Supabase auth session (this server has no
per-request user auth — same reasoning as v1's `add_note`/`create_campaign`).

- [ ] **Step 1: Write `tools/outreach.ts`**

```typescript
import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import { MCP_CRM_USER_ID } from '../config.ts'
import type { ToolDef } from './types.ts'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const outreachTools: ToolDef[] = [
  {
    name: 'send_outreach_email',
    description:
      'Send a single outreach email to a prospect immediately (not via a campaign). Requires confirm: true.',
    schema: {
      prospect_id: z.number().int(),
      subject: z.string().min(1),
      body: z.string().min(1),
      confirm: z.boolean().default(false),
    },
    handler: async ({ prospect_id, subject, body, confirm }) => {
      if (!confirm) {
        return errorResult(
          `Sending this email to prospect ${prospect_id} will dispatch a real message immediately, ` +
            `with no delay to catch a mistake. Re-call with confirm: true to proceed.`,
        )
      }

      const { data: prospect, error: prospectErr } = await supabase
        .from('prospects')
        .select('id, email, fullname')
        .eq('id', prospect_id)
        .maybeSingle()
      if (prospectErr) return errorResult(prospectErr.message)
      if (!prospect) return errorResult(`No prospect found with id ${prospect_id}`)
      if (!prospect.email) return errorResult(`Prospect ${prospect_id} has no email address on file`)

      const resendKey = Deno.env.get('RESEND_API_KEY')
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'
      if (!resendKey) {
        return errorResult('RESEND_API_KEY not set — add it in Supabase Edge Function Secrets')
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Brisk CRM <${fromEmail}>`,
          to: [prospect.email],
          subject,
          html: body,
        }),
      })

      const resendData = await resendRes.json().catch(() => null)
      if (!resendRes.ok) {
        return errorResult(resendData?.message ?? `Resend returned ${resendRes.status}`)
      }

      const { error: actErr } = await supabase.from('activities').insert({
        type: 'email',
        title: subject,
        description: `Outreach sent to: ${prospect.email}`,
        prospect_id,
        created_by: MCP_CRM_USER_ID,
      })
      if (actErr) console.warn('[send_outreach_email] activity log failed:', actErr.message)

      return jsonResult({ sent: true, to: prospect.email, resend_id: resendData?.id ?? null })
    },
  },
]
```

- [ ] **Step 2: Update `tools/registry.ts`**

```typescript
import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'
import { campaignTools } from './campaigns.ts'
import { noteTools } from './notes.ts'
import { workflowTools } from './workflows.ts'
import { reportTools } from './reports.ts'
import { outreachTools } from './outreach.ts'

export const TOOLS: ToolDef[] = [
  ...prospectTools,
  ...dealTools,
  ...campaignTools,
  ...noteTools,
  ...workflowTools,
  ...reportTools,
  ...outreachTools,
]
```

- [ ] **Step 3: Extend `scripts/verify-http.mjs`**

```javascript
  if (!names.includes('send_outreach_email')) throw new Error('missing tool: send_outreach_email')

  console.log('=== tools/call: send_outreach_email WITHOUT confirm (MOST IMPORTANT CHECK) ===')
  const noConfirmEmail = await rpc(
    'tools/call',
    { name: 'send_outreach_email', arguments: { prospect_id: 1, subject: 'test', body: 'test', confirm: false } },
    10,
  )
  console.log(JSON.stringify(noConfirmEmail.body, null, 2))
  if (noConfirmEmail.body?.result?.isError !== true) {
    throw new Error('send_outreach_email without confirm did not return isError:true')
  }
  if (JSON.stringify(noConfirmEmail.body).includes('"sent":true')) {
    throw new Error('send_outreach_email without confirm appears to have sent something')
  }
```

- [ ] **Step 4: Run the verification script**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: all prior checks pass, `send_outreach_email` is listed, and calling it without `confirm: true` returns `isError: true` with no evidence a send happened. This is the same guardrail pattern as `activate_campaign` and must hold the same way.

- [ ] **Step 5: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/tools/outreach.ts crm-app/supabase/functions/crm-mcp/tools/registry.ts crm-app/supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat(crm-mcp): add guarded send_outreach_email tool"
```

---

### Task 9: README, Supabase Dashboard deploy guide, claude.ai registration

**Files:**
- Create: `crm-app/supabase/functions/crm-mcp/README.md`

**Interfaces:**
- Consumes: nothing new — this task documents everything built in Tasks 1–8.
- Produces: nothing consumed by later tasks (final task).

- [ ] **Step 1: Write `crm-app/supabase/functions/crm-mcp/README.md`**

```markdown
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
   `config.ts`, and `tools/*.ts` are part of the deployed function).
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
```

- [ ] **Step 2: Run the full verification script one final time**

Run: `cd crm-app/supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: `ALL CHECKS PASSED`, confirming all 19 tools (18 ported + `send_outreach_email`) are present and every guardrail/error-path check still holds after the README addition (which touches no code).

- [ ] **Step 3: Commit**

```bash
git add crm-app/supabase/functions/crm-mcp/README.md
git commit -m "docs(crm-mcp): add deploy guide, claude.ai registration steps, and guardrail notes"
```

---

## Post-plan note

Deploying `crm-mcp` (Task 9, Step 1 of its README) and registering it in claude.ai are manual,
human-driven steps requiring the real Supabase Dashboard and claude.ai account — they cannot be
executed or faked by an automated implementer in a sandboxed environment, the same limitation v1's
Task 8 had with `claude mcp add`. The deliverable of this plan is a fully built, locally
verified `crm-mcp` function ready to deploy; the deploy + registration + one real live
end-to-end email test are follow-up actions for the user to perform themselves.
