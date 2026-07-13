import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Status upgrade-only — never downgrade
const STATUS_PRIORITY = [
  'pending','sent','opened','clicked','replied','bounced','unsubscribed',
]

// Stage upgrade-only — never downgrade
const STAGE_PRIORITY = [
  'New Lead','Contacted','Qualified','Proposal Sent',
  'Negotiation','Closed Won','Closed Lost',
]

const EVENT_MAP: Record<string, string> = {
  'email.opened':     'opened',
  'email.clicked':    'clicked',
  'email.bounced':    'bounced',
  'email.complained': 'unsubscribed',
}

const TIMESTAMP_FIELD: Record<string, string> = {
  opened:       'opened_at',
  clicked:      'clicked_at',
  bounced:      'bounced_at',
  unsubscribed: 'unsubscribed_at',
}

// Email event → deal stage mapping
const STAGE_MAP: Record<string, string> = {
  sent:    'New Lead',
  opened:  'Contacted',
  clicked: 'Contacted',
  replied: 'Qualified',
}

async function autoPipelineUpdate(prospectId: number, eventType: string, campaignId: string, campaignName: string) {
  const newStage = STAGE_MAP[eventType]
  if (!newStage) return

  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id, stage')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingDeal) {
    const currentIdx = STAGE_PRIORITY.indexOf(existingDeal.stage)
    const newIdx     = STAGE_PRIORITY.indexOf(newStage)
    if (newIdx > currentIdx) {
      await supabase
        .from('deals')
        .update({ stage: newStage, stage_changed_at: new Date().toISOString() })
        .eq('id', existingDeal.id)
    }
  } else if (eventType === 'replied') {
    // Auto-create deal only on reply (strong buying signal)
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
      source_campaign_id:   campaignId,
      source_campaign_name: campaignName,
    })
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: { type: string; data: { email_id: string; [key: string]: unknown } }
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { type, data } = payload
  const eventType = EVENT_MAP[type]

  if (!eventType) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })
  }

  const { data: recipient, error } = await supabase
    .from('campaign_recipients')
    .select('*, email_campaigns(name)')
    .eq('resend_message_id', data.email_id)
    .single()

  if (error || !recipient) {
    return new Response(JSON.stringify({ error: 'Recipient not found' }), { status: 404 })
  }

  // Upgrade status only — never downgrade
  const currentIdx = STATUS_PRIORITY.indexOf(recipient.status)
  const newIdx     = STATUS_PRIORITY.indexOf(eventType)

  if (newIdx > currentIdx) {
    await supabase
      .from('campaign_recipients')
      .update({
        status: eventType,
        [TIMESTAMP_FIELD[eventType]]: new Date().toISOString(),
      })
      .eq('id', recipient.id)
  }

  // Log every event (even if status not upgraded)
  await supabase.from('email_events').insert({
    campaign_id:  recipient.campaign_id,
    recipient_id: recipient.id,
    prospect_id:  recipient.prospect_id,
    event_type:   eventType,
    event_data:   data,
  })

  // Log to activities table
  const campaignName = (recipient as Record<string, unknown> & { email_campaigns?: { name: string } | null })
    .email_campaigns?.name ?? 'Campaign'
  await supabase.from('activities').insert({
    type:         'email',
    title:        `Email ${eventType} — ${campaignName}`,
    status:       'completed',
    prospect_id:  recipient.prospect_id,
    completed_at: new Date().toISOString(),
  })

  // Trigger pipeline auto-update
  await autoPipelineUpdate(Number(recipient.prospect_id), eventType, recipient.campaign_id, campaignName)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
