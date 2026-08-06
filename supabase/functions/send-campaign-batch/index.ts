import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)

function resolveVars(template: string, prospect: Record<string, string | null>): string {
  return template
    .replace(/{{first_name}}/g,   prospect.firstname   ?? '')
    .replace(/{{last_name}}/g,    prospect.lastname    ?? '')
    .replace(/{{full_name}}/g,    prospect.fullname    ?? '')
    .replace(/{{company}}/g,      prospect.company     ?? 'your company')
    .replace(/{{job_title}}/g,    prospect.jobtitle    ?? '')
    .replace(/{{website}}/g,      prospect.website     ?? '')
    .replace(/{{my_name}}/g,      'Peter Paul Lazan')
    .replace(/{{my_portfolio}}/g, 'peterpaullazan.com')
}

const SIGNATURE = '\n\nBest regards,\nPeter Paul Lazan\nWhatsApp: 09515379127\nhttps://www.peterpaullazan.com/\nhttps://github.com/FearCleevan/'

Deno.serve(async () => {
  const { data: campaigns, error: campaignError } = await supabase
    .from('email_campaigns')
    .select(`
      id, name, daily_limit,
      email_templates ( id, subject, body ),
      crm_users ( first_name, last_name )
    `)
    .eq('status', 'active')

  if (campaignError) {
    return new Response(JSON.stringify({ error: campaignError.message }), { status: 500 })
  }

  const today = new Date().toISOString().split('T')[0]
  let totalSent = 0

  for (const campaign of campaigns ?? []) {
    if (!campaign.email_templates) continue

    const { count: sentToday } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('event_type', 'sent')
      .gte('occurred_at', `${today}T00:00:00Z`)

    const remaining = campaign.daily_limit - (sentToday ?? 0)
    if (remaining <= 0) continue

    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select(`
        id, prospect_id, campaign_id,
        prospects (
          id, firstname, lastname, fullname,
          email, company, jobtitle, website
        )
      `)
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .limit(remaining)

    for (const recipient of recipients ?? []) {
      const prospect = recipient.prospects as Record<string, string | null> | null
      if (!prospect?.email) continue

      const template   = campaign.email_templates as { subject: string; body: string }
      const subject    = resolveVars(template.subject, prospect)
      const body       = resolveVars(template.body,    prospect)
      const senderName = `${campaign.crm_users?.first_name ?? ''} ${campaign.crm_users?.last_name ?? ''}`.trim()

      const { data: sent, error: sendError } = await resend.emails.send({
        from:    `${senderName} <peter@peterpaullazan.com>`,
        to:      prospect.email,
        subject,
        text:    body + SIGNATURE,
      })

      if (!sendError && sent?.id) {
        await supabase
          .from('campaign_recipients')
          .update({
            status:            'sent',
            resend_message_id: sent.id,
            sent_at:           new Date().toISOString(),
          })
          .eq('id', recipient.id)

        await supabase.from('email_events').insert({
          campaign_id:  campaign.id,
          recipient_id: recipient.id,
          prospect_id:  prospect.id,
          event_type:   'sent',
          event_data:   { resend_message_id: sent.id },
        })

        await supabase.from('activities').insert({
          type:         'email',
          title:        `Campaign email sent: ${campaign.name}`,
          description:  subject,
          status:       'completed',
          prospect_id:  prospect.id,
          email_to:     prospect.email,
          email_body:   body,
          completed_at: new Date().toISOString(),
        })

        totalSent++
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, totalSent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
