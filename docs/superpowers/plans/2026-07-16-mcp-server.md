# CRM MCP Server (local dev connector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, stdio-based MCP server that gives Claude Code full read/write access to the CRM's core business entities (prospects, deals, campaigns, notes, workflows, reports), with a confirm-gated `activate_campaign` tool since that triggers real email dispatch.

**Architecture:** Standalone Node/TypeScript package at `crm-app/mcp-server/`, independent of the Vite app's build. Uses `@modelcontextprotocol/sdk`'s `McpServer` + `StdioServerTransport`, and `@supabase/supabase-js` with the `service_role` key (bypasses RLS — this server is local-only, run by one developer). One tool-registration module per entity domain under `src/tools/`.

**Tech Stack:** TypeScript (compiled via `tsc`, ESM/`NodeNext`), `@modelcontextprotocol/sdk` `^1.29.0`, `@supabase/supabase-js` `^2.105.4` (matches the main app), `zod` `^4.4.3` (matches the main app) for tool input schemas.

## Global Constraints

- Server is local-only, stdio transport, registered via `claude mcp add` — no remote hosting, no OAuth (spec non-goal).
- Uses `SUPABASE_SERVICE_ROLE_KEY` from `crm-app/mcp-server/.env.local` — a **separate** env file from the main app's, never loaded by Vite (spec architecture requirement).
- No MCP tools for `crm_users` management, API keys/integrations, IP whitelist, rate limits, or other security/admin tables (spec non-goal).
- No workflow execution trigger tool — read-only `list_workflows`/`get_workflow_runs` only, since no execution engine exists yet (spec non-goal).
- `activate_campaign` must require `confirm: true` or return a structured error — it is the only tool that causes real external side effects (spec goal).
- No automated test suite (matches the rest of the project — no Jest/Vitest anywhere). Verification is manual via the official `@modelcontextprotocol/inspector` CLI per task, and a real Claude Code session in the final task (spec non-goal).
- `email_campaigns.user_id` and other `created_by`/`user_id` columns are attributed to a single configured `MCP_CRM_USER_ID` env var (a real `crm_users.id`), since this server has no per-request human auth context.

---

## File Structure

```
crm-app/mcp-server/
  package.json
  tsconfig.json
  .gitignore
  .env.local.example
  README.md
  src/
    supabaseClient.ts   — creates the Supabase client from env vars
    config.ts           — reads/validates MCP_CRM_USER_ID
    index.ts            — McpServer setup, registers all tool modules, connects stdio transport
    tools/
      prospects.ts       — search_prospects, get_prospect, create_prospect, update_prospect
      deals.ts           — list_deals, get_deal, update_deal_stage, create_deal
      campaigns.ts       — list_campaigns, get_campaign, create_campaign, activate_campaign, list_campaign_recipients
      notes.ts           — list_notes, add_note (activities table, type='note')
      workflows.ts       — list_workflows, get_workflow_runs (read-only)
      reports.ts         — get_report (wraps existing dashboard RPCs)
```

---

### Task 1: Scaffold the package, Supabase client, and config

**Files:**
- Create: `crm-app/mcp-server/package.json`
- Create: `crm-app/mcp-server/tsconfig.json`
- Create: `crm-app/mcp-server/.gitignore`
- Create: `crm-app/mcp-server/.env.local.example`
- Create: `crm-app/mcp-server/src/supabaseClient.ts`
- Create: `crm-app/mcp-server/src/config.ts`
- Create: `crm-app/mcp-server/src/index.ts`

**Interfaces:**
- Produces: `supabase` (exported `SupabaseClient` instance) from `src/supabaseClient.ts`, used by every file under `src/tools/`.
- Produces: `MCP_CRM_USER_ID: string | null` (exported const) from `src/config.ts`, used by `campaigns.ts` and `notes.ts`.
- Produces: `server: McpServer` (exported instance) from `src/index.ts`. Later tasks do **not** import this directly — to avoid a circular import between `index.ts` and the tool modules, each tool module instead exports a `registerXTools(server: McpServer): void` function, and `index.ts` imports and calls each one, passing its own local `server`. `src/index.ts` itself calls `server.connect(new StdioServerTransport())` at the bottom, guarded so it only runs when the file is executed directly (not when imported by another entrypoint), using `if (import.meta.url === \`file://${process.argv[1]}\`)`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "crm-mcp-server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@supabase/supabase-js": "^2.105.4",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "typescript": "~6.0.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.env.local
```

- [ ] **Step 4: Create `.env.local.example`**

```
# Copy to .env.local and fill in real values — .env.local is gitignored.
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: Supabase Dashboard → Project Settings → API.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# The crm_users.id row this server's writes (created_by/user_id) are attributed to.
# Find it via: select id from crm_users where email = 'you@example.com';
MCP_CRM_USER_ID=
```

- [ ] **Step 5: Install dependencies**

Run: `cd crm-app/mcp-server && npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Write `src/supabaseClient.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.local.example to .env.local and fill in real values.',
  )
}

export const supabase = createClient(url, key)
```

- [ ] **Step 7: Write `src/config.ts`**

```typescript
export const MCP_CRM_USER_ID: string | null = process.env.MCP_CRM_USER_ID ?? null
```

- [ ] **Step 8: Write `src/index.ts`**

```typescript
import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export const server = new McpServer({
  name: 'crm-mcp-server',
  version: '0.1.0',
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[crm-mcp-server] fatal error:', err)
    process.exit(1)
  })
}
```

`dotenv/config` needs adding as a dependency too — add `"dotenv": "^16.4.7"` to `package.json` dependencies (Step 1 above) and re-run `npm install` if you already ran it before adding this line.

- [ ] **Step 9: Build**

Run: `cd crm-app/mcp-server && npm run build`
Expected: `dist/index.js` created, no TypeScript errors.

- [ ] **Step 10: Manually verify the server starts and responds to `initialize`**

Run: `cd crm-app/mcp-server && npx @modelcontextprotocol/inspector node dist/index.js`
Expected: Inspector opens a local browser UI, connects to the server, shows server name `crm-mcp-server` version `0.1.0`, and an empty tools list (no tools registered yet — expected at this stage). Close the inspector (Ctrl+C) once confirmed.

- [ ] **Step 11: Commit**

```bash
git add crm-app/mcp-server/package.json crm-app/mcp-server/tsconfig.json crm-app/mcp-server/.gitignore crm-app/mcp-server/.env.local.example crm-app/mcp-server/src/supabaseClient.ts crm-app/mcp-server/src/config.ts crm-app/mcp-server/src/index.ts crm-app/mcp-server/package-lock.json
git commit -m "feat(mcp-server): scaffold package, Supabase client, and config"
```

---

### Task 2: Prospects tools

**Files:**
- Create: `crm-app/mcp-server/src/tools/prospects.ts`
- Modify: `crm-app/mcp-server/src/index.ts` (register the new tools)

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.js` (Task 1), `server` from `../index.js` is NOT imported here — instead this file exports a `registerProspectTools(server: McpServer)` function that `index.ts` calls, to avoid a circular import between `index.ts` and the tool modules.
- Produces: `registerProspectTools(server: McpServer): void`, used by `index.ts`.

- [ ] **Step 1: Write `src/tools/prospects.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'

const PROSPECT_COLUMNS =
  'id, fullname, firstname, lastname, email, company, jobtitle, city, state, country, status, created_on'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerProspectTools(server: McpServer) {
  server.tool(
    'search_prospects',
    'Search prospects by name, email, or company (case-insensitive partial match)',
    {
      query: z.string().min(1).describe('Search term matched against full name, email, and company'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ query, limit }) => {
      const { data, error } = await supabase
        .from('prospects')
        .select(PROSPECT_COLUMNS)
        .or(`fullname.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
        .limit(limit)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool(
    'get_prospect',
    'Get a single prospect by id',
    { id: z.number().int() },
    async ({ id }) => {
      const { data, error } = await supabase.from('prospects').select('*').eq('id', id).maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No prospect found with id ${id}`)
      return jsonResult(data)
    },
  )

  server.tool(
    'create_prospect',
    'Create a new prospect',
    {
      firstname: z.string().min(1),
      lastname: z.string().min(1),
      email: z.string().email(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).default('New'),
    },
    async ({ firstname, lastname, email, company, jobtitle, status }) => {
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
  )

  server.tool(
    'update_prospect',
    'Update fields on an existing prospect',
    {
      id: z.number().int(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).optional(),
    },
    async ({ id, ...updates }) => {
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
  )
}
```

- [ ] **Step 2: Register in `src/index.ts`**

Add near the top, after the `server` instantiation:

```typescript
import { registerProspectTools } from './tools/prospects.js'
```

And immediately after `export const server = new McpServer(...)`:

```typescript
registerProspectTools(server)
```

- [ ] **Step 3: Build**

Run: `cd crm-app/mcp-server && npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manually verify with the inspector**

Run: `cd crm-app/mcp-server && npx @modelcontextprotocol/inspector node dist/index.js`
In the inspector's Tools tab: confirm `search_prospects`, `get_prospect`, `create_prospect`, `update_prospect` are listed. Call `search_prospects` with `{ "query": "a", "limit": 5 }` and confirm it returns real rows (or an empty array, not an error) from your actual Supabase project.

- [ ] **Step 5: Commit**

```bash
git add crm-app/mcp-server/src/tools/prospects.ts crm-app/mcp-server/src/index.ts
git commit -m "feat(mcp-server): add prospects tools"
```

---

### Task 3: Deals tools

**Files:**
- Create: `crm-app/mcp-server/src/tools/deals.ts`
- Modify: `crm-app/mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.js`.
- Produces: `registerDealTools(server: McpServer): void`.

- [ ] **Step 1: Write `src/tools/deals.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'

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

export function registerDealTools(server: McpServer) {
  server.tool(
    'list_deals',
    'List deals, optionally filtered by pipeline stage',
    { stage: z.enum(DEAL_STAGES).optional(), limit: z.number().int().min(1).max(200).default(50) },
    async ({ stage, limit }) => {
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
  )

  server.tool('get_deal', 'Get a single deal by id', { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle()
    if (error) return errorResult(error.message)
    if (!data) return errorResult(`No deal found with id ${id}`)
    return jsonResult(data)
  })

  server.tool(
    'update_deal_stage',
    'Move a deal to a different pipeline stage',
    { id: z.string().uuid(), stage: z.enum(DEAL_STAGES) },
    async ({ id, stage }) => {
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
  )

  server.tool(
    'create_deal',
    'Create a new deal',
    {
      name: z.string().min(1),
      prospect_name: z.string().default(''),
      company: z.string().default(''),
      stage: z.enum(DEAL_STAGES).default('New Lead'),
      value: z.number().default(0),
      probability: z.number().int().min(0).max(100).default(10),
      expected_close_date: z.string().describe('YYYY-MM-DD').optional(),
    },
    async ({ name, prospect_name, company, stage, value, probability, expected_close_date }) => {
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
  )
}
```

- [ ] **Step 2: Register in `src/index.ts`**

Add import: `import { registerDealTools } from './tools/deals.js'`
Add call after `registerProspectTools(server)`: `registerDealTools(server)`

- [ ] **Step 3: Build**

Run: `cd crm-app/mcp-server && npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manually verify with the inspector**

Run: `cd crm-app/mcp-server && npx @modelcontextprotocol/inspector node dist/index.js`
Confirm `list_deals`, `get_deal`, `update_deal_stage`, `create_deal` are listed. Call `list_deals` with `{}` and confirm real deal rows come back.

- [ ] **Step 5: Commit**

```bash
git add crm-app/mcp-server/src/tools/deals.ts crm-app/mcp-server/src/index.ts
git commit -m "feat(mcp-server): add deals tools"
```

---

### Task 4: Campaign tools (with guarded `activate_campaign`)

**Files:**
- Create: `crm-app/mcp-server/src/tools/campaigns.ts`
- Modify: `crm-app/mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.js`, `MCP_CRM_USER_ID` from `../config.js` (Task 1).
- Produces: `registerCampaignTools(server: McpServer): void`.

- [ ] **Step 1: Write `src/tools/campaigns.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import { MCP_CRM_USER_ID } from '../config.js'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerCampaignTools(server: McpServer) {
  server.tool(
    'list_campaigns',
    'List email campaigns, optionally filtered by status',
    { status: z.enum(['draft', 'active', 'paused', 'completed']).optional() },
    async ({ status }) => {
      let q = supabase
        .from('email_campaigns')
        .select('id, name, status, daily_limit, total_recipients, total_sent, created_at')
        .order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool('get_campaign', 'Get a single campaign by id', { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*, email_templates(name, subject)')
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResult(error.message)
    if (!data) return errorResult(`No campaign found with id ${id}`)
    return jsonResult(data)
  })

  server.tool(
    'create_campaign',
    'Create a new email campaign (status starts as draft)',
    {
      name: z.string().min(1),
      description: z.string().optional(),
      template_id: z.string().uuid().optional(),
      daily_limit: z.number().int().min(10).max(500).default(50),
    },
    async ({ name, description, template_id, daily_limit }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in .env.local — set it to a real crm_users.id before creating campaigns.',
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
  )

  server.tool(
    'activate_campaign',
    'Activate a draft/paused campaign so it starts sending real emails via the dispatch-campaign-batch cron job. Requires confirm: true.',
    { id: z.string().uuid(), confirm: z.boolean().default(false) },
    async ({ id, confirm }) => {
      const { count, error: countErr } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('status', 'pending')
      if (countErr) return errorResult(countErr.message)

      if (!confirm) {
        return errorResult(
          `Activating this campaign will start sending real emails to ${count ?? 0} pending recipients ` +
            `(picked up by the dispatch-campaign-batch cron job within 15 minutes). Re-call with confirm: true to proceed.`,
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
  )

  server.tool(
    'list_campaign_recipients',
    'List the recipients of a campaign and their send status',
    { campaign_id: z.string().uuid() },
    async ({ campaign_id }) => {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('id, prospect_id, status, sent_at, opened_at, clicked_at, replied_at, bounced_at')
        .eq('campaign_id', campaign_id)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )
}
```

- [ ] **Step 2: Register in `src/index.ts`**

Add import: `import { registerCampaignTools } from './tools/campaigns.js'`
Add call: `registerCampaignTools(server)`

- [ ] **Step 3: Build**

Run: `cd crm-app/mcp-server && npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manually verify with the inspector — including the guardrail**

Run: `cd crm-app/mcp-server && npx @modelcontextprotocol/inspector node dist/index.js`
Confirm all 5 campaign tools are listed. Call `activate_campaign` with `{ "id": "<a real draft campaign's id>", "confirm": false }` and confirm it returns an `isError: true` result describing the pending recipient count, **without** changing the campaign's status (verify via `get_campaign` right after). Do not call it with `confirm: true` unless you intend to actually activate that campaign.

- [ ] **Step 5: Commit**

```bash
git add crm-app/mcp-server/src/tools/campaigns.ts crm-app/mcp-server/src/index.ts
git commit -m "feat(mcp-server): add campaign tools with guarded activate_campaign"
```

---

### Task 5: Notes tools

**Files:**
- Create: `crm-app/mcp-server/src/tools/notes.ts`
- Modify: `crm-app/mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.js`, `MCP_CRM_USER_ID` from `../config.js`.
- Produces: `registerNoteTools(server: McpServer): void`.

- [ ] **Step 1: Write `src/tools/notes.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import { MCP_CRM_USER_ID } from '../config.js'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerNoteTools(server: McpServer) {
  server.tool(
    'list_notes',
    'List notes attached to a prospect (notes are stored as activities with type=note)',
    { prospect_id: z.number().int() },
    async ({ prospect_id }) => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, title, description, created_by, created_at')
        .eq('type', 'note')
        .eq('prospect_id', prospect_id)
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool(
    'add_note',
    'Add a note to a prospect',
    { prospect_id: z.number().int(), title: z.string().min(1), description: z.string().optional() },
    async ({ prospect_id, title, description }) => {
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
  )
}
```

- [ ] **Step 2: Register in `src/index.ts`**

Add import: `import { registerNoteTools } from './tools/notes.js'`
Add call: `registerNoteTools(server)`

- [ ] **Step 3: Build**

Run: `cd crm-app/mcp-server && npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manually verify with the inspector**

Run: `cd crm-app/mcp-server && npx @modelcontextprotocol/inspector node dist/index.js`
Confirm `list_notes` and `add_note` are listed. Call `add_note` with a real `prospect_id`, then `list_notes` for that same id and confirm the new note appears.

- [ ] **Step 5: Commit**

```bash
git add crm-app/mcp-server/src/tools/notes.ts crm-app/mcp-server/src/index.ts
git commit -m "feat(mcp-server): add notes tools"
```

---

### Task 6: Workflow tools (read-only)

**Files:**
- Create: `crm-app/mcp-server/src/tools/workflows.ts`
- Modify: `crm-app/mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.js`.
- Produces: `registerWorkflowTools(server: McpServer): void`.

- [ ] **Step 1: Write `src/tools/workflows.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerWorkflowTools(server: McpServer) {
  server.tool(
    'list_workflows',
    'List all workflows (read-only — there is no execution engine to trigger runs yet)',
    {},
    async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, description, status, trigger, run_count, last_run')
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool(
    'get_workflow_runs',
    'Get the run log for a single workflow',
    { workflow_id: z.string().uuid() },
    async ({ workflow_id }) => {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('id, status, record_label, record_link, duration, error, created_at')
        .eq('workflow_id', workflow_id)
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )
}
```

- [ ] **Step 2: Register in `src/index.ts`**

Add import: `import { registerWorkflowTools } from './tools/workflows.js'`
Add call: `registerWorkflowTools(server)`

- [ ] **Step 3: Build**

Run: `cd crm-app/mcp-server && npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manually verify with the inspector**

Run: `cd crm-app/mcp-server && npx @modelcontextprotocol/inspector node dist/index.js`
Confirm `list_workflows` and `get_workflow_runs` are listed and return data (or an empty array — `workflow_runs` has no writer yet per the spec, so an empty array is expected and correct, not a bug).

- [ ] **Step 5: Commit**

```bash
git add crm-app/mcp-server/src/tools/workflows.ts crm-app/mcp-server/src/index.ts
git commit -m "feat(mcp-server): add read-only workflow tools"
```

---

### Task 7: Reports tool

**Files:**
- Create: `crm-app/mcp-server/src/tools/reports.ts`
- Modify: `crm-app/mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabaseClient.js`.
- Produces: `registerReportTools(server: McpServer): void`.

- [ ] **Step 1: Write `src/tools/reports.ts`**

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'

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

export function registerReportTools(server: McpServer) {
  server.tool(
    'get_report',
    'Get one of the CRM dashboard reports: dashboard_metrics, revenue_by_month, leads_breakdown, conversion_funnel, activity_breakdown',
    {
      type: z.enum(REPORT_TYPES),
      date_range: z.enum(['7d', '30d', 'month', 'quarter', 'year']).default('30d'),
    },
    async ({ type, date_range }) => {
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
  )
}
```

- [ ] **Step 2: Register in `src/index.ts`**

Add import: `import { registerReportTools } from './tools/reports.js'`
Add call: `registerReportTools(server)`

- [ ] **Step 3: Build**

Run: `cd crm-app/mcp-server && npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Manually verify with the inspector**

Run: `cd crm-app/mcp-server && npx @modelcontextprotocol/inspector node dist/index.js`
Confirm `get_report` is listed. Call it with `{ "type": "dashboard_metrics" }` and confirm real numbers come back matching what the Dashboard page shows.

- [ ] **Step 5: Commit**

```bash
git add crm-app/mcp-server/src/tools/reports.ts crm-app/mcp-server/src/index.ts
git commit -m "feat(mcp-server): add reports tool"
```

---

### Task 8: README, registration with Claude Code, and end-to-end verification

**Files:**
- Create: `crm-app/mcp-server/README.md`

**Interfaces:**
- Consumes: nothing new — this task is documentation + manual registration/verification of everything built in Tasks 1–7.
- Produces: nothing consumed by later tasks (this is the final task).

- [ ] **Step 1: Write `crm-app/mcp-server/README.md`**

```markdown
# CRM MCP Server (local dev connector)

A local, stdio-based MCP server exposing the Brisk CRM's core data
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
```

- [ ] **Step 2: Register the server with Claude Code**

Run: `claude mcp add crm -- node crm-app/mcp-server/dist/index.js`
Expected: confirmation that the `crm` MCP server was added.
Run: `claude mcp list`
Expected: `crm` appears in the list, connected.

- [ ] **Step 3: End-to-end verification in a real Claude Code session**

In a Claude Code session (this one or a new one), ask Claude to use the `crm` MCP server to: search for a real prospect, list deals in one stage, list active campaigns, and get the `dashboard_metrics` report. Confirm each tool call returns real data matching what you see in the CRM app itself.

- [ ] **Step 4: Commit**

```bash
git add crm-app/mcp-server/README.md
git commit -m "docs(mcp-server): add setup README and complete v1 tool surface"
```

---

## Post-plan note

`campaign_recipients` need to already exist (via the app's campaign wizard,
per the existing recipient-add flow) before `activate_campaign` has anything
to dispatch — this plan's `create_campaign` tool creates a campaign but does
not add recipients; a follow-up `add_campaign_recipients` tool was
deliberately left out of v1 scope (spec covers create/activate, not full
recipient management) and can be a fast follow if needed.
