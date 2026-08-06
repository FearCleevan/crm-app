// ============================================================
// Brisk CRM — crm-mcp Edge Function (SINGLE-FILE DEPLOY BUNDLE)
// ============================================================
// This file is a manual merge of index.ts + auth.ts + jsonRpc.ts +
// oauth.ts + supabaseClient.ts + config.ts + tools/*.ts, generated so
// it can be pasted as the ONLY file in the Supabase Dashboard's edge
// function editor (which defaults to a single index.ts). The modular
// source files under supabase/functions/crm-mcp/ remain the source of
// truth for local dev/testing (scripts/verify-http.mjs) — if you
// change any logic, edit the modular files and regenerate this
// bundle, don't hand-edit this file and let it drift.
//
// Deploy: paste this entire file as index.ts when creating/updating
// the "crm-mcp" function in the Supabase Dashboard. Then also add a
// deno.json file (contents below, in the same directory) so npm:
// specifiers resolve to pinned versions.
//
// Includes the OAuth 2.1 layer (metadata discovery, DCR /register,
// token-gated /authorize, PKCE-verifying /token) added on top of the
// v1 bearer-token design — claude.ai's connector flow requires OAuth
// and will attempt Dynamic Client Registration automatically. The
// existing bearer-token check on the main "/" JSON-RPC endpoint is
// UNCHANGED; the OAuth layer just gives claude.ai a way to obtain that
// same CRM_MCP_TOKEN value as an access_token via its own flow.
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

// ── OAuth 2.1 layer (metadata, DCR register, authorize, token) ─
const ALLOWED_REDIRECT_URIS = ['https://claude.ai/api/mcp/auth_callback']

function crmMcpBaseUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mcp`
}

function publicBaseUrl(): string {
  return Deno.env.get('MCP_PUBLIC_URL') ?? crmMcpBaseUrl()
}

function protectedResourceMetadataUrl(): string {
  return `${publicBaseUrl()}/.well-known/oauth-protected-resource`
}

function base64urlEncode(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlEncodeString(s: string): string {
  return base64urlEncode(new TextEncoder().encode(s))
}

function base64urlDecodeToString(s: string): string {
  const pad = (4 - (s.length % 4)) % 4
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return base64urlEncode(new Uint8Array(sig))
}

async function sha256Base64url(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return base64urlEncode(new Uint8Array(hash))
}

async function handleMetadata(_req: Request): Promise<Response> {
  const base = publicBaseUrl()
  const body = {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function handleProtectedResourceMetadata(_req: Request): Promise<Response> {
  const base = publicBaseUrl()
  const body = {
    resource: base,
    authorization_servers: [base],
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function handleRegister(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const clientId = crypto.randomUUID()
  return new Response(
    JSON.stringify({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris ?? [],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    }),
    { status: 201, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderAuthorizeForm(params: {
  redirectUri: string
  clientId: string
  codeChallenge: string
  state: string
  error?: string
}): Response {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Authorize Brisk CRM connector</title></head>
<body style="font-family: sans-serif; max-width: 420px; margin: 60px auto;">
  <h2>Authorize Brisk CRM connector</h2>
  <p>Enter your CRM_MCP_TOKEN to allow this connector to access your CRM.</p>
  ${params.error ? `<p style="color:#c00">${escapeHtml(params.error)}</p>` : ''}
  <form method="POST">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
    <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
    <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
    <input type="password" name="token" placeholder="CRM_MCP_TOKEN"
      style="width:100%;padding:8px;margin:12px 0;box-sizing:border-box;" autofocus />
    <button type="submit" style="padding:8px 16px;">Authorize</button>
  </form>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  })
}

async function handleAuthorizeGet(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  const clientId = url.searchParams.get('client_id') ?? ''
  const codeChallenge = url.searchParams.get('code_challenge') ?? ''
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? ''
  const state = url.searchParams.get('state') ?? ''

  if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400, headers: CORS })
  }
  if (codeChallengeMethod !== 'S256' || !codeChallenge) {
    return new Response('PKCE code_challenge (S256) is required', { status: 400, headers: CORS })
  }

  return renderAuthorizeForm({ redirectUri, clientId, codeChallenge, state })
}

async function signAuthCode(
  payload: { redirect_uri: string; code_challenge: string; exp: number },
  secret: string,
): Promise<string> {
  const payloadB64 = base64urlEncodeString(JSON.stringify(payload))
  const signature = await hmacSign(payloadB64, secret)
  return `${payloadB64}.${signature}`
}

async function verifyAuthCode(
  code: string,
  secret: string,
): Promise<{ redirect_uri: string; code_challenge: string; exp: number } | null> {
  const parts = code.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, signature] = parts

  const expectedSig = await hmacSign(payloadB64, secret)
  if (!(await timingSafeEqual(signature, expectedSig))) return null

  try {
    const payload = JSON.parse(base64urlDecodeToString(payloadB64))
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
    if (typeof payload.redirect_uri !== 'string' || typeof payload.code_challenge !== 'string') return null
    return payload
  } catch {
    return null
  }
}

function oauthError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function handleToken(req: Request): Promise<Response> {
  const contentType = req.headers.get('Content-Type') ?? ''
  let params: URLSearchParams
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    params = new URLSearchParams(body)
  } else {
    params = new URLSearchParams(await req.text())
  }

  const grantType = params.get('grant_type')
  const code = params.get('code') ?? ''
  const codeVerifier = params.get('code_verifier') ?? ''

  if (grantType !== 'authorization_code') {
    return oauthError('unsupported_grant_type', 400)
  }

  const secret = Deno.env.get('CRM_MCP_TOKEN')
  if (!secret) return oauthError('server_error', 500)

  const payload = await verifyAuthCode(code, secret)
  if (!payload) return oauthError('invalid_grant', 400)

  const computedChallenge = await sha256Base64url(codeVerifier)
  if (!(await timingSafeEqual(computedChallenge, payload.code_challenge))) {
    return oauthError('invalid_grant', 400)
  }

  return new Response(
    JSON.stringify({ access_token: secret, token_type: 'Bearer', expires_in: 31536000 }),
    {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  )
}

async function handleAuthorizePost(req: Request): Promise<Response> {
  const form = await req.formData()
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const clientId = String(form.get('client_id') ?? '')
  const codeChallenge = String(form.get('code_challenge') ?? '')
  const state = String(form.get('state') ?? '')
  const token = String(form.get('token') ?? '')

  if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400, headers: CORS })
  }
  if (!codeChallenge) {
    return new Response('PKCE code_challenge (S256) is required', { status: 400, headers: CORS })
  }

  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected || !(await timingSafeEqual(token, expected))) {
    // Relative path only (no scheme/host) — the browser resolves it against whatever
    // origin it's currently on. This assumes /authorize is reached via the Vercel proxy;
    // hitting this Supabase URL directly would 404 on this redirect (handleAuthorizeGet
    // above remains a fallback for direct GET hits, but this POST retry path depends on
    // the Vercel origin).
    const retry = new URL('/authorize', 'https://placeholder.invalid')
    retry.searchParams.set('redirect_uri', redirectUri)
    retry.searchParams.set('client_id', clientId)
    retry.searchParams.set('code_challenge', codeChallenge)
    retry.searchParams.set('code_challenge_method', 'S256')
    retry.searchParams.set('state', state)
    retry.searchParams.set('error', 'invalid_token')
    return new Response(null, {
      status: 302,
      headers: { ...CORS, Location: `${retry.pathname}${retry.search}` },
    })
  }

  const code = await signAuthCode(
    { redirect_uri: redirectUri, code_challenge: codeChallenge, exp: Date.now() + 5 * 60_000 },
    expected,
  )

  const redirectUrl = new URL(redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (state) redirectUrl.searchParams.set('state', state)

  return new Response(null, { status: 302, headers: { ...CORS, Location: redirectUrl.toString() } })
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

// ── Email template merge-field detection ────────────────────────
const TEMPLATE_VARIABLE_TOKENS = [
  '{{first_name}}',
  '{{last_name}}',
  '{{company}}',
  '{{job_title}}',
  '{{website}}',
  '{{my_name}}',
  '{{my_portfolio}}',
]

function extractTemplateVariables(body: string): string[] {
  return TEMPLATE_VARIABLE_TOKENS
    .filter((token) => body.includes(token))
    .map((token) => token.slice(2, -2))
}

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
  {
    name: 'create_email_template',
    description:
      'Create a reusable email template. Merge-field placeholders like {{first_name}} and {{company}} in the body are detected automatically.',
    schema: {
      name: z.string().min(1),
      category: z.enum([
        'general', 'follow_up', 'introduction', 'proposal', 'closing',
        're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
      ]).default('general'),
      subject: z.string().min(1),
      body: z.string().min(1),
    },
    handler: async ({ name, category, subject, body }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in Supabase Edge Function Secrets — set it to a real crm_users.id before creating templates.',
        )
      }
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name,
          category,
          subject,
          body,
          created_by: MCP_CRM_USER_ID,
          is_active: true,
          variables: extractTemplateVariables(body),
        })
        .select('id, name, category, subject, variables, created_at')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'list_email_templates',
    description: 'List active email templates, optionally filtered by category',
    schema: {
      category: z.enum([
        'general', 'follow_up', 'introduction', 'proposal', 'closing',
        're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
      ]).optional(),
    },
    handler: async ({ category }) => {
      let q = supabase
        .from('email_templates')
        .select('id, name, category, subject, variables, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (category) q = q.eq('category', category)
      const { data, error } = await q
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

// ── Outreach tool (send_outreach_email, guarded) ────────────────
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
        .select('id, email, fullname, status')
        .eq('id', prospect_id)
        .maybeSingle()
      if (prospectErr) return errorResult(prospectErr.message)
      if (!prospect) return errorResult(`No prospect found with id ${prospect_id}`)
      if (!prospect.email) return errorResult(`Prospect ${prospect_id} has no email address on file`)

      const resendKey = Deno.env.get('RESEND_API_KEY')
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
          from: 'Peter Paul Lazan <peter@peterpaullazan.com>',
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
        email_to: prospect.email,
        email_body: body,
        created_by: MCP_CRM_USER_ID,
      })
      if (actErr) console.warn('[send_outreach_email] activity log failed:', actErr.message)

      // Upgrade-only, same pattern as resend-webhook's stage bump: a fresh outreach send is a
      // weak signal the prospect has been reached out to, but should never downgrade an already
      // further-along status (Qualified/Closed) back to Contacted.
      let statusUpdated = false
      if (prospect.status === 'New') {
        const { error: statusErr } = await supabase
          .from('prospects')
          .update({ status: 'Contacted', updated_on: new Date().toISOString() })
          .eq('id', prospect_id)
        if (statusErr) console.warn('[send_outreach_email] status update failed:', statusErr.message)
        else statusUpdated = true
      }

      return jsonResult({
        sent: true,
        to: prospect.email,
        resend_id: resendData?.id ?? null,
        status_updated: statusUpdated ? 'New -> Contacted' : null,
      })
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
  const pathname = new URL(req.url).pathname

  if (req.method === 'GET' && pathname.endsWith('/.well-known/oauth-authorization-server')) {
    return handleMetadata(req)
  }
  if (req.method === 'GET' && pathname.endsWith('/.well-known/oauth-protected-resource')) {
    return handleProtectedResourceMetadata(req)
  }
  if (req.method === 'POST' && pathname.endsWith('/register')) {
    return handleRegister(req)
  }
  if (req.method === 'GET' && pathname.endsWith('/authorize')) {
    return handleAuthorizeGet(req)
  }
  if (req.method === 'POST' && pathname.endsWith('/authorize')) {
    return handleAuthorizePost(req)
  }
  if (req.method === 'POST' && pathname.endsWith('/token')) {
    return handleToken(req)
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  if (!(await checkAuth(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${protectedResourceMetadataUrl()}"`,
      },
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
