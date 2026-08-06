// ============================================================
// Brisk CRM — send-email Edge Function
// Sends an email via Resend API and logs it to activities.
// Requires: RESEND_API_KEY and RESEND_FROM_EMAIL in Supabase Secrets.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── 1. Auth ───────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !caller) {
      console.error('[send-email] auth error:', authErr?.message)
      return json({ error: 'Unauthorized' }, 401)
    }
    console.log('[send-email] caller:', caller.id)

    // ── 2. Parse body ─────────────────────────────────────────
    let body: { to?: unknown; cc?: unknown; subject?: unknown; html?: unknown; threadId?: unknown; prospectId?: unknown }
    try {
      body = await req.json()
    } catch (e) {
      console.error('[send-email] body parse error:', e)
      return json({ error: 'Invalid request body' }, 400)
    }

    const { to, cc, subject, html, threadId, prospectId } = body

    if (!to || !subject || !html) {
      return json({ error: 'Missing required fields: to, subject, html' }, 400)
    }

    // ── 3. Fetch sender's crm_users row (for activity log) ────
    const { data: crmUser } = await admin
      .from('crm_users')
      .select('id')
      .eq('auth_id', caller.id)
      .maybeSingle()
    console.log('[send-email] crmUser:', crmUser?.id ?? 'not found')

    // ── 4. Send via Resend ────────────────────────────────────
    const resendKey  = Deno.env.get('RESEND_API_KEY')

    if (!resendKey) {
      console.error('[send-email] RESEND_API_KEY not set')
      return json({ error: 'Email service not configured — add RESEND_API_KEY to Supabase Secrets' }, 503)
    }

    console.log('[send-email] sending to:', to, 'from: peter@peterpaullazan.com')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Peter Paul Lazan <peter@peterpaullazan.com>',
        to:      Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(cc ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
      }),
    })

    const resendData = await resendRes.json().catch(() => null)
    console.log('[send-email] Resend status:', resendRes.status, JSON.stringify(resendData))

    if (!resendRes.ok) {
      return json({ error: resendData?.message ?? 'Failed to send email' }, 502)
    }

    // ── 5. Bump prospect status New -> Contacted (upgrade-only, best-effort) ──
    // Same guard as crm-mcp/tools/outreach.ts's send_outreach_email tool: a send
    // is a weak signal the prospect has been reached out to, but must never
    // downgrade an already further-along status (Qualified/Closed/etc).
    let statusUpdated = false
    if (typeof prospectId === 'number') {
      const { data: prospectRow, error: prospectErr } = await admin
        .from('prospects')
        .select('status')
        .eq('id', prospectId)
        .maybeSingle()
      if (prospectErr) {
        console.warn('[send-email] prospect lookup failed:', prospectErr.message)
      } else if (prospectRow?.status === 'New') {
        const { error: statusErr } = await admin
          .from('prospects')
          .update({ status: 'Contacted', updated_on: new Date().toISOString() })
          .eq('id', prospectId)
        if (statusErr) console.warn('[send-email] status update failed:', statusErr.message)
        else statusUpdated = true
      }
    }

    // ── 6. Log to activities (best-effort) ────────────────────
    if (crmUser) {
      const toList = Array.isArray(to) ? to.join(', ') : String(to)
      const { error: actErr } = await admin
        .from('activities')
        .insert({
          type:        'email',
          title:       subject,
          description: `Sent to: ${toList}`,
          email_to:    toList,
          email_body:  html,
          thread_id:   typeof threadId === 'string' ? threadId : null,
          created_by:  crmUser.id,
          deal_id:     null,
        })
      if (actErr) console.warn('[send-email] activity log failed:', actErr.message)

      // ── 7. Fire webhook event (fire-and-forget) ───────────────
      admin.functions.invoke('trigger-webhook', {
        body: {
          event:       'email.sent',
          crm_user_id: crmUser.id,
          payload: {
            subject,
            to:   Array.isArray(to) ? to : [to],
            ...(cc ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
          },
        },
      }).catch((err: unknown) => {
        console.warn('[send-email] trigger-webhook invoke failed:', err instanceof Error ? err.message : err)
      })
    }

    return json({ success: true, status_updated: statusUpdated })
  } catch (err) {
    console.error('[send-email] unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
