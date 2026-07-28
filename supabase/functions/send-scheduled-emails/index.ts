// ============================================================
// Brisk CRM — send-scheduled-emails Edge Function
// Dispatches due rows from `scheduled_emails` (status='pending',
// scheduled_at <= now()) via Resend. Invoked on a timer by the
// `dispatch-scheduled-emails` pg_cron job — not called by the
// frontend directly.
// Requires: RESEND_API_KEY and RESEND_FROM_EMAIL in Supabase Secrets.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const BATCH_LIMIT = 50

Deno.serve(async () => {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'

  if (!resendKey) {
    console.error('[send-scheduled-emails] RESEND_API_KEY not set')
    return new Response(
      JSON.stringify({ error: 'Email service not configured — add RESEND_API_KEY to Supabase Secrets' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { data: due, error: fetchErr } = await supabase
    .from('scheduled_emails')
    .select('id, created_by, to_addresses, cc_addresses, bcc_addresses, subject, html')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(BATCH_LIMIT)

  if (fetchErr) {
    console.error('[send-scheduled-emails] fetch error:', fetchErr.message)
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let failed = 0

  for (const row of due ?? []) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    `Peter Paul Lazan <${fromEmail}>`,
          to:      row.to_addresses,
          subject: row.subject,
          html:    row.html,
          reply_to: 'lazanpeterpaul@gmail.com',
          ...(row.cc_addresses?.length ? { cc: row.cc_addresses } : {}),
          ...(row.bcc_addresses?.length ? { bcc: row.bcc_addresses } : {}),
        }),
      })

      const resendData = await resendRes.json().catch(() => null)

      if (!resendRes.ok) {
        console.error('[send-scheduled-emails] Resend error for', row.id, resendData)
        await supabase
          .from('scheduled_emails')
          .update({
            status:        'failed',
            error_message: resendData?.message ?? `Resend returned ${resendRes.status}`,
          })
          .eq('id', row.id)
        failed++
        continue
      }

      await supabase
        .from('scheduled_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id)

      await supabase.from('activities').insert({
        type:        'email',
        title:       row.subject,
        description: `Scheduled send to: ${row.to_addresses.join(', ')}`,
        email_to:    row.to_addresses.join(', '),
        email_body:  row.html,
        created_by:  row.created_by,
      })

      sent++
    } catch (err) {
      console.error('[send-scheduled-emails] unhandled error for', row.id, err)
      await supabase
        .from('scheduled_emails')
        .update({
          status:        'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('id', row.id)
      failed++
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, checked: due?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
