// ============================================================
// Brisk CRM — crm-mcp Edge Function (SINGLE-FILE DEPLOY BUNDLE)
// ============================================================
// This file is a manual merge of index.ts + auth.ts + jsonRpc.ts +
// supabaseClient.ts + config.ts + tools/*.ts, generated so it can be
// pasted as the ONLY file in the Supabase Dashboard's edge function
// editor (which defaults to a single index.ts). The modular source
// files under supabase/functions/crm-mcp/ remain the source of truth
// for local dev/testing (scripts/verify-http.mjs) — if you change tool
// logic, edit the modular files and regenerate this bundle, don't hand-edit
// this file and let it drift.
//
// Deploy: paste this entire file as index.ts when creating the "crm-mcp"
// function in the Supabase Dashboard. Then also add a deno.json file
// (contents below, in the same directory) so npm: specifiers resolve to
// pinned versions.
// ============================================================

import { z } from 'npm:zod@4'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Shared result helpers ────────────────────────────────────
function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

interface ToolDef {
  name: string
  description: string
  schema: Record<string, z.ZodTypeAny>
  handler: (args: any) => Promise<ToolResult>
}

// ── Config ────────────────────────────────────────────────────
const MCP_CRM_USER_ID: string | null = Deno.env.get('MCP_CRM_USER_ID') ?? null

// ── Supabase client ───────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── CORS + JSON-RPC helpers ───────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonRpcResult(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function jsonRpcError(id: unknown, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── Auth (constant-time bearer token check) ───────────────────
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  const bytesA = new Uint8Array(hashA)
  const bytesB = new Uint8Array(hashB)
  if (bytesA.length !== bytesB.length) return false
  let diff = 0
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i]
  }
  return diff === 0
}

async function checkAuth(req: Request): Promise<boolean> {
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected) return false
  const received = req.headers.get('Authorization')
  if (!received) return false
  return timingSafeEqual(received, `Bearer ${expected}`)
}

// ── Prospect tools ─────────────────────────────────────────────
const PROSPECT_COLUMNS =
  'id, fullname, firstname, lastname, email, company, jobtitle, city, state, country, status, created_on'

const prospectTools: ToolDef[] = [
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

// ── Deal tools ─────────────────────────────────────────────────
const DEAL_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
] as const

const dealTools: ToolDef[] = [
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

// ── Campaign tools ─────────────────────────────────────────────
const campaignTools: ToolDef[] = [
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

// ── Note tools ─────────────────────────────────────────────────
const noteTools: ToolDef[] = [
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

// ── Workflow tools (read-only) ──────────────────────────────────
const workflowTools: ToolDef[] = [
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

// ── Report tool ──────────────────────────────────────────────────
const REPORT_TYPES = [
  'dashboard_metrics',
  'revenue_by_month',
  'leads_breakdown',
  'conversion_funnel',
  'activity_breakdown',
] as const

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

const reportTools: ToolDef[] = [
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
        default:
          return errorResult(`Unknown report type: ${type}`)
      }
    },
  },
]

// ── Outreach tool (new — send_outreach_email, guarded) ────────────
const outreachTools: ToolDef[] = [
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

      // Deliberately not checking MCP_CRM_USER_ID for null here (unlike add_note/create_campaign):
      // the email has already been sent, and this log write is best-effort (console.warn only on
      // failure), so we don't want to fail a successfully-sent email over a missing attribution id.
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

// ── Combined tool registry ────────────────────────────────────
const TOOLS: ToolDef[] = [
  ...prospectTools,
  ...dealTools,
  ...campaignTools,
  ...noteTools,
  ...workflowTools,
  ...reportTools,
  ...outreachTools,
]

// ── Server ───────────────────────────────────────────────────
const SERVER_INFO = { name: 'crm-mcp', version: '0.1.0' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  if (!(await checkAuth(req))) {
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
          inputSchema: z.toJSONSchema(z.object(t.schema)),
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
