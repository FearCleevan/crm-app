// ============================================================
// Paul CRM — gmail-sync Edge Function
// Pulls new messages from the connected Gmail inbox (lazanpeterpaul@gmail.com), matches the
// sender against prospects.email, and stores ONLY matched replies in `received_emails`.
// Unmatched personal mail is discarded, never persisted — this inbox is not dedicated to the
// CRM. Invoked on a timer by the `sync-gmail-inbox` pg_cron job (see 024_cron_gmail_sync.sql),
// not called by the frontend directly.
// Requires: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase Secrets (same ones
// gmail-oauth-callback uses).
// Part of Phase 3b/3c, EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md.
//
// Also wires the previously-dead 'replied' pipeline path: on each NEWLY matched reply (not
// re-runs over an already-stored message, thanks to the OVERLAP_MS re-check window), logs an
// `activities` row and runs the same upgrade-only stage progression / auto-deal-creation logic
// resend-webhook's autoPipelineUpdate already has for other email events — this is the first
// real trigger for it.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// The "Sync Now" button in Settings -> API Integration calls this function directly from the
// browser (cross-origin, unlike the pg_cron-invoked calls) -- needs CORS headers or the
// preflight OPTIONS request gets blocked before the real POST ever fires.
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_MESSAGES_PER_RUN = 50
const DEFAULT_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000 // 2 days, used only on the very first sync
const OVERLAP_MS = 5 * 60 * 1000 // re-check the last 5 min each run to absorb clock skew; safe, dedup is by gmail_message_id

interface GmailHeader { name: string; value: string }
interface GmailPart {
  mimeType?: string
  body?: { data?: string; size?: number }
  parts?: GmailPart[]
}
interface GmailMessage {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  payload?: GmailPart & { headers?: GmailHeader[] }
}

function base64urlDecode(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)))
}

// Walks the (possibly nested multipart) payload tree for the first text/plain and text/html bodies.
function extractBodies(payload?: GmailPart): { text: string | null; html: string | null } {
  let text: string | null = null
  let html: string | null = null

  function walk(part?: GmailPart) {
    if (!part) return
    if (part.mimeType === 'text/plain' && part.body?.data && !text) text = base64urlDecode(part.body.data)
    if (part.mimeType === 'text/html' && part.body?.data && !html) html = base64urlDecode(part.body.data)
    for (const child of part.parts ?? []) walk(child)
  }
  walk(payload)
  return { text, html }
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

// "Name <email@example.com>" -> { name: "Name", email: "email@example.com" }
function parseFromHeader(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*(.*?)\s*<(.+)>\s*$/)
  if (match) return { name: match[1].replace(/^"|"$/g, ''), email: match[2].trim().toLowerCase() }
  return { name: '', email: raw.trim().toLowerCase() }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// Stage upgrade-only — never downgrade. Mirrors resend-webhook's STAGE_PRIORITY/autoPipelineUpdate,
// specialized here to the single 'replied' event this function can ever trigger (a Gmail reply
// isn't necessarily tied to a specific campaign, unlike the webhook's other events).
const STAGE_PRIORITY = [
  'New Lead', 'Contacted', 'Qualified', 'Proposal Sent',
  'Negotiation', 'Closed Won', 'Closed Lost',
]

async function applyRepliedPipelineUpdate(prospectId: number) {
  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id, stage')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingDeal) {
    const currentIdx = STAGE_PRIORITY.indexOf(existingDeal.stage)
    const newIdx     = STAGE_PRIORITY.indexOf('Qualified')
    if (newIdx > currentIdx) {
      await supabase
        .from('deals')
        .update({ stage: 'Qualified', stage_changed_at: new Date().toISOString() })
        .eq('id', existingDeal.id)
    }
    return
  }

  // Auto-create a deal only on reply (strong buying signal), same as resend-webhook
  const { data: prospect } = await supabase
    .from('prospects')
    .select('fullname, firstname, company')
    .eq('id', prospectId)
    .single()

  const closeDate = new Date()
  closeDate.setDate(closeDate.getDate() + 30)

  await supabase.from('deals').insert({
    name:                `${prospect?.company ?? 'Unknown'} — Website Project`,
    prospect_id:         prospectId,
    prospect_name:       prospect?.fullname ?? prospect?.firstname ?? '',
    company:             prospect?.company ?? '',
    stage:               'Qualified',
    value:               0,
    probability:         30,
    expected_close_date: closeDate.toISOString().split('T')[0],
    stage_changed_at:    new Date().toISOString(),
    source_campaign_id:   null,
    source_campaign_name: null,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error('[gmail-sync] GOOGLE_CLIENT_ID/SECRET not set')
    return json({ error: 'not_configured' }, 503)
  }

  // ── 1. Load the connected Gmail integration ─────────────────
  const { data: integration, error: intErr } = await supabase
    .from('integrations')
    .select('id, config, last_synced_at')
    .eq('provider', 'gmail')
    .eq('status', 'active')
    .maybeSingle()

  if (intErr || !integration) {
    console.log('[gmail-sync] no active Gmail integration connected, skipping')
    return json({ ok: true, skipped: 'not_connected' })
  }

  const refreshToken = (integration.config as { refresh_token?: string })?.refresh_token
  if (!refreshToken) {
    console.error('[gmail-sync] integration row has no refresh_token')
    return json({ error: 'missing_refresh_token' }, 500)
  }

  // ── 2. Refresh the access token ──────────────────────────────
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('[gmail-sync] token refresh failed:', JSON.stringify(tokenData))
    await supabase.from('integrations').update({ status: 'error' }).eq('id', integration.id)
    return json({ error: 'token_refresh_failed' }, 502)
  }
  const accessToken = tokenData.access_token as string

  // ── 3. List new messages since the last sync ─────────────────
  // Deliberately NOT scoped to in:inbox — tools like Front archive the underlying Gmail
  // message the moment it's triaged there, which strips the INBOX label. Search All Mail
  // instead (still excluding Spam/Trash) so replies that got auto-archived elsewhere are
  // still picked up.
  const sinceMs = integration.last_synced_at
    ? new Date(integration.last_synced_at).getTime() - OVERLAP_MS
    : Date.now() - DEFAULT_LOOKBACK_MS
  const afterEpochSeconds = Math.floor(sinceMs / 1000)

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  listUrl.searchParams.set('q', `after:${afterEpochSeconds} -in:spam -in:trash`)
  listUrl.searchParams.set('maxResults', String(MAX_MESSAGES_PER_RUN))

  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
  const listData = await listRes.json()
  if (!listRes.ok) {
    console.error('[gmail-sync] messages.list failed:', JSON.stringify(listData))
    return json({ error: 'list_failed' }, 502)
  }

  const messageRefs: { id: string }[] = listData.messages ?? []
  let matched = 0
  let skipped = 0

  // ── 4. Fetch each message, match against prospects, store matches only ──
  for (const ref of messageRefs) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const msg: GmailMessage = await msgRes.json()
      if (!msgRes.ok) {
        console.warn('[gmail-sync] failed to fetch message', ref.id)
        continue
      }

      const headers = msg.payload?.headers
      const from = parseFromHeader(getHeader(headers, 'From'))
      if (!from.email) { skipped++; continue }

      const { data: prospect } = await supabase
        .from('prospects')
        .select('id')
        .ilike('email', from.email)
        .maybeSingle()

      if (!prospect) { skipped++; continue } // not a match — discard, never stored

      // Only fire the 'replied' side effects (activity log + pipeline update) for messages we
      // haven't seen before — the OVERLAP_MS window intentionally re-checks recent messages
      // each run, and we don't want to re-log/re-bump on every re-run of the same reply.
      const { data: alreadyStored } = await supabase
        .from('received_emails')
        .select('id')
        .eq('gmail_message_id', msg.id)
        .maybeSingle()
      const isNewMatch = !alreadyStored

      const { text, html } = extractBodies(msg.payload)
      const { error: upsertErr } = await supabase
        .from('received_emails')
        .upsert(
          {
            gmail_message_id: msg.id,
            gmail_thread_id:  msg.threadId,
            prospect_id:      prospect.id,
            from_email:       from.email,
            from_name:        from.name || null,
            to_email:         getHeader(headers, 'To') || null,
            subject:          getHeader(headers, 'Subject') || null,
            body_html:        html,
            body_text:        text,
            snippet:          msg.snippet ?? null,
            received_at:      msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString(),
          },
          { onConflict: 'gmail_message_id' },
        )
      if (upsertErr) {
        console.error('[gmail-sync] upsert failed for', msg.id, upsertErr.message)
        continue
      }
      matched++

      if (isNewMatch) {
        await supabase.from('activities').insert({
          type:         'email',
          title:        'Email replied',
          description:  getHeader(headers, 'Subject') || null,
          status:       'completed',
          prospect_id:  prospect.id,
          completed_at: new Date().toISOString(),
        })
        await applyRepliedPipelineUpdate(prospect.id)
      }
    } catch (err) {
      console.error('[gmail-sync] error processing message', ref.id, err)
    }
  }

  // ── 5. Record sync time ──────────────────────────────────────
  await supabase.from('integrations').update({ last_synced_at: new Date().toISOString() }).eq('id', integration.id)

  console.log('[gmail-sync] checked:', messageRefs.length, 'matched:', matched, 'skipped:', skipped)
  return json({ ok: true, checked: messageRefs.length, matched, skipped })
})
