# BRISK CRM — Master Upgrade Implementation
## BACKEND_IMPLEMENTATION.md (Consolidated — All Features)

---

## Overview

Full backend implementation for all Brisk CRM upgrades, built on top of the
**exact existing Supabase schema** from `github.com/FearCleevan/crm-app`.

### Purpose
Wire all frontend features (Phases 1–9) to real Supabase data + Resend email delivery.

### Existing Stack
- Supabase PostgreSQL + Auth + RLS + Edge Functions
- React 18 + TypeScript + Vite (frontend)
- Resend (email delivery API)

---

## Existing Schema — Full Reuse Map

| Existing Table | Used For |
|----------------|----------|
| `prospects` | Source of all campaign recipients (`id` is `bigint`) |
| `email_templates` | Already exists — extend with 2 columns |
| `deals` | Auto-create/update via pipeline auto-update (`prospect_id` is `integer`) |
| `activities` | Log all email events (`type: 'email'`, has `prospect_id bigint`) |
| `integrations` | Store Resend API config per user |
| `system_settings` | Store global outreach settings |
| `crm_users` | Sender identity, role checks (`auth_id` → `auth.users.id`) |
| `prospects_country` | Country filter dropdown |
| `prospects_industry` | Industry filter dropdown |
| `prospects_email_status` | Email status filter dropdown |
| `import_sessions` | Pattern reference for campaign batch tracking |
| `pipeline_sessions` | Pattern reference for column mapping |

### ⚠️ Critical Type Notes
| Field | Type | TypeScript Type |
|-------|------|----------------|
| `prospects.id` | `bigint` | `number` |
| `deals.prospect_id` | `integer` | `number` |
| `activities.prospect_id` | `bigint` | `number` |
| `crm_users.auth_id` | `uuid` | `string` (links to auth.users.id) |
| `email_templates.created_by` | `uuid` | `string` (links to crm_users.id) |
| `campaign_recipients.prospect_id` | `bigint` | `number` (must match prospects.id) |

---

## Phases Overview

| Phase | Name | Description |
|-------|------|-------------|
| B1 | Schema Migrations | Extend existing tables + add 3 new tables |
| B2 | RLS Policies | Security on all new tables |
| B3 | Resend Integration | Email delivery setup via integrations table |
| B4 | Edge Function — Send Batch | Daily batch email sender |
| B5 | Edge Function — Webhooks | Receive open/click/reply events |
| B6 | Campaign Service Layer | All campaign Supabase queries + hooks |
| B7 | Template Service Upgrade | Extend existing template queries |
| B8 | Export Column Service | Backend support for filtered column export |
| B9 | Pipeline Auto-Update | Auto-move deal stage on email events |
| B10 | Scheduled Sender | pg_cron hourly trigger |
| B11 | Settings Persistence | Outreach settings via integrations + system_settings |

---

## Phase B1 — Schema Migrations

### Migration 004 — Extend Existing email_templates

```sql
-- email_templates already exists. Only ADD missing columns.
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES public.crm_users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Extend category CHECK to include new cold outreach types
ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_category_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_category_check
  CHECK (category = ANY (ARRAY[
    'general',
    'follow_up',
    'introduction',
    'proposal',
    'closing',
    're_engagement',
    'newsletter',
    'cold_outreach',
    'no_website',
    'outdated_website'
  ]));
```

### Migration 005 — New Tables

```sql
-- =============================================
-- TABLE: email_campaigns
-- =============================================
CREATE TABLE public.email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.crm_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_id uuid
    REFERENCES public.email_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY[
      'draft', 'active', 'paused', 'completed'
    ])),
  daily_limit integer NOT NULL DEFAULT 50
    CHECK (daily_limit >= 10 AND daily_limit <= 500),
  send_from_hour integer NOT NULL DEFAULT 9
    CHECK (send_from_hour >= 0 AND send_from_hour <= 23),
  send_to_hour integer NOT NULL DEFAULT 17
    CHECK (send_to_hour >= 0 AND send_to_hour <= 23),
  send_days text[] NOT NULL
    DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  warmup_enabled boolean NOT NULL DEFAULT false,
  -- Aggregate counters (updated by trigger)
  total_recipients integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_opened integer NOT NULL DEFAULT 0,
  total_clicked integer NOT NULL DEFAULT 0,
  total_replied integer NOT NULL DEFAULT 0,
  total_bounced integer NOT NULL DEFAULT 0,
  total_unsubscribed integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_campaigns_pkey PRIMARY KEY (id)
);

-- =============================================
-- TABLE: campaign_recipients
-- prospects.id is bigint — prospect_id must be bigint
-- =============================================
CREATE TABLE public.campaign_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL
    REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  prospect_id bigint NOT NULL
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending', 'sent', 'opened', 'clicked',
      'replied', 'bounced', 'unsubscribed'
    ])),
  resend_message_id text,
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  replied_at timestamp with time zone,
  bounced_at timestamp with time zone,
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_recipients_unique
    UNIQUE (campaign_id, prospect_id)
);

-- =============================================
-- TABLE: email_events
-- Granular per-event log (supplements activities table)
-- =============================================
CREATE TABLE public.email_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid
    REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid
    REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  prospect_id bigint
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type = ANY (ARRAY[
      'sent', 'opened', 'clicked',
      'replied', 'bounced', 'unsubscribed'
    ])),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_events_pkey PRIMARY KEY (id)
);
```

### Migration 005 — Indexes

```sql
-- email_campaigns
CREATE INDEX idx_email_campaigns_user_id
  ON public.email_campaigns(user_id);
CREATE INDEX idx_email_campaigns_status
  ON public.email_campaigns(status);

-- campaign_recipients
CREATE INDEX idx_campaign_recipients_campaign_id
  ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_prospect_id
  ON public.campaign_recipients(prospect_id);
CREATE INDEX idx_campaign_recipients_status
  ON public.campaign_recipients(status);
CREATE INDEX idx_campaign_recipients_resend_id
  ON public.campaign_recipients(resend_message_id)
  WHERE resend_message_id IS NOT NULL;

-- email_events
CREATE INDEX idx_email_events_campaign_id
  ON public.email_events(campaign_id);
CREATE INDEX idx_email_events_prospect_id
  ON public.email_events(prospect_id);
CREATE INDEX idx_email_events_event_type
  ON public.email_events(event_type);
CREATE INDEX idx_email_events_occurred_at
  ON public.email_events(occurred_at DESC);
```

### Migration 005 — Triggers

```sql
-- Auto-update updated_at on email_campaigns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-increment campaign aggregate counters
-- when campaign_recipients.status changes
CREATE OR REPLACE FUNCTION update_campaign_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status = 'pending' THEN
    UPDATE public.email_campaigns
    SET total_sent = total_sent + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'opened' AND OLD.status NOT IN ('opened','clicked','replied','bounced') THEN
    UPDATE public.email_campaigns
    SET total_opened = total_opened + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'clicked' AND OLD.status NOT IN ('clicked','replied','bounced') THEN
    UPDATE public.email_campaigns
    SET total_clicked = total_clicked + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'replied' AND OLD.status NOT IN ('replied','bounced') THEN
    UPDATE public.email_campaigns
    SET total_replied = total_replied + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'bounced' AND OLD.status != 'bounced' THEN
    UPDATE public.email_campaigns
    SET total_bounced = total_bounced + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'unsubscribed' AND OLD.status != 'unsubscribed' THEN
    UPDATE public.email_campaigns
    SET total_unsubscribed = total_unsubscribed + 1
    WHERE id = NEW.campaign_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_campaign_counters
  AFTER UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_counters();

-- Auto-update total_recipients when recipients are added
CREATE OR REPLACE FUNCTION update_campaign_recipient_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_recipients = (
    SELECT COUNT(*) FROM public.campaign_recipients
    WHERE campaign_id = NEW.campaign_id
  )
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_recipient_count
  AFTER INSERT OR DELETE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_recipient_count();
```

### Migration 005 — Bulk Add Prospects SQL Function

```sql
-- Callable from frontend via supabase.rpc()
-- Bulk adds filtered prospects to a campaign in one shot
CREATE OR REPLACE FUNCTION add_filtered_prospects_to_campaign(
  p_campaign_id uuid,
  p_country text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_seniority text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.campaign_recipients (campaign_id, prospect_id, status)
  SELECT
    p_campaign_id,
    p.id,
    'pending'
  FROM public.prospects p
  WHERE
    p.email IS NOT NULL
    AND p.isactive = true
    AND (p_country IS NULL OR p.country ILIKE p_country)
    AND (p_industry IS NULL OR p.industry ILIKE p_industry)
    AND (p_seniority IS NULL OR p.seniority ILIKE p_seniority)
    AND p.id NOT IN (
      SELECT prospect_id
      FROM public.campaign_recipients
      WHERE campaign_id = p_campaign_id
    )
  ORDER BY p.created_on DESC
  LIMIT p_limit
  ON CONFLICT (campaign_id, prospect_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Phase B2 — RLS Policies

```sql
-- Enable RLS on new tables
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Helper: get crm_users.id from auth session
-- (crm_users.auth_id = auth.uid())

-- email_campaigns: user manages own
CREATE POLICY "Users manage own campaigns"
ON public.email_campaigns FOR ALL
USING (
  user_id IN (
    SELECT id FROM public.crm_users
    WHERE auth_id = auth.uid()
  )
);

-- campaign_recipients: accessible if campaign belongs to user
CREATE POLICY "Users access own campaign recipients"
ON public.campaign_recipients FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

-- email_events: accessible if campaign belongs to user
CREATE POLICY "Users access own email events"
ON public.email_events FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

-- Extend email_templates RLS (created_by is crm_users.id)
CREATE POLICY "Users manage own templates"
ON public.email_templates FOR ALL
USING (
  created_by IN (
    SELECT id FROM public.crm_users
    WHERE auth_id = auth.uid()
  )
);
```

---

## Phase B3 — Resend Integration

### Store Config in Existing `integrations` Table

```typescript
// src/services/outreachSettingsService.ts

export async function saveResendConfig(userId: string, config: {
  sender_name: string
  sender_email: string
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
  unsubscribe_footer: boolean
  unsubscribe_text: string
}) {
  return supabase.from('integrations').upsert({
    user_id: userId,
    provider: 'resend',
    label: 'Resend Email Outreach',
    config,
    status: 'active',
  }, { onConflict: 'user_id,provider' })
}

export async function getResendConfig(userId: string) {
  return supabase
    .from('integrations')
    .select('config, status, last_synced_at')
    .eq('user_id', userId)
    .eq('provider', 'resend')
    .single()
}
```

### Store API Key in Supabase Vault (server-side only)

```sql
-- Run in Supabase SQL Editor
SELECT vault.create_secret(
  'your-resend-api-key-here',
  'resend_api_key',
  'Resend API key for campaign email delivery'
);
```

### Resend DNS Records (after buying lazandev.dev)

```
Type   Host                    Value
TXT    lazandev.dev            v=spf1 include:_spf.resend.com ~all
CNAME  resend._domainkey       [provided by Resend dashboard]
TXT    _dmarc.lazandev.dev     v=DMARC1; p=none;
```

---

## Phase B4 — Edge Function: Send Batch

### File: `supabase/functions/send-campaign-batch/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)

Deno.serve(async () => {
  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select('*, email_templates(*), crm_users(first_name, last_name, email)')
    .eq('status', 'active')

  for (const campaign of campaigns ?? []) {
    const today = new Date().toISOString().split('T')[0]

    const { count: sentToday } = await supabase
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('event_type', 'sent')
      .gte('occurred_at', `${today}T00:00:00Z`)

    const remaining = campaign.daily_limit - (sentToday ?? 0)
    if (remaining <= 0) continue

    // prospects.id is bigint — select as number
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
      const prospect = recipient.prospects
      if (!prospect?.email) continue

      const subject = resolveVars(campaign.email_templates.subject, prospect)
      const body = resolveVars(campaign.email_templates.body, prospect)

      const senderName = `${campaign.crm_users.first_name} ${campaign.crm_users.last_name}`

      const { data: sent, error } = await resend.emails.send({
        from: `${senderName} <peter@lazandev.dev>`,
        to: prospect.email,
        subject,
        text: body,
      })

      if (!error && sent?.id) {
        // Update recipient status
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'sent',
            resend_message_id: sent.id,
            sent_at: new Date().toISOString(),
          })
          .eq('id', recipient.id)

        // Log to email_events
        await supabase.from('email_events').insert({
          campaign_id: campaign.id,
          recipient_id: recipient.id,
          prospect_id: prospect.id, // bigint
          event_type: 'sent',
          event_data: { resend_message_id: sent.id },
        })

        // Log to existing activities table
        await supabase.from('activities').insert({
          type: 'email',
          title: `Campaign email sent: ${campaign.name}`,
          description: subject,
          status: 'completed',
          prospect_id: prospect.id, // bigint — already supported
          completed_at: new Date().toISOString(),
        })
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function resolveVars(template: string, prospect: any): string {
  return template
    .replace(/{{first_name}}/g, prospect.firstname ?? '')
    .replace(/{{last_name}}/g, prospect.lastname ?? '')
    .replace(/{{full_name}}/g, prospect.fullname ?? '')
    .replace(/{{company}}/g, prospect.company ?? 'your company')
    .replace(/{{job_title}}/g, prospect.jobtitle ?? '')
    .replace(/{{website}}/g, prospect.website ?? '')
    .replace(/{{my_name}}/g, 'Peter Lazan')
    .replace(/{{my_portfolio}}/g, 'lazandev.vercel.app')
}
```

---

## Phase B5 — Edge Function: Webhooks

### File: `supabase/functions/resend-webhook/index.ts`

```typescript
Deno.serve(async (req) => {
  const payload = await req.json()
  const { type, data } = payload

  const eventMap: Record<string, string> = {
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'unsubscribed',
  }

  const eventType = eventMap[type]
  if (!eventType) return new Response('OK', { status: 200 })

  // Find recipient by resend_message_id
  const { data: recipient } = await supabase
    .from('campaign_recipients')
    .select('*, email_campaigns(name)')
    .eq('resend_message_id', data.email_id)
    .single()

  if (!recipient) return new Response('Not found', { status: 404 })

  // Status priority — only upgrade, never downgrade
  const priority = [
    'pending','sent','opened','clicked',
    'replied','bounced','unsubscribed'
  ]
  const currentIdx = priority.indexOf(recipient.status)
  const newIdx = priority.indexOf(eventType)

  const timestampField: Record<string, string> = {
    opened: 'opened_at',
    clicked: 'clicked_at',
    bounced: 'bounced_at',
    unsubscribed: 'unsubscribed_at',
  }

  if (newIdx > currentIdx) {
    await supabase
      .from('campaign_recipients')
      .update({
        status: eventType,
        [timestampField[eventType]]: new Date().toISOString(),
      })
      .eq('id', recipient.id)
  }

  // Log email_event
  await supabase.from('email_events').insert({
    campaign_id: recipient.campaign_id,
    recipient_id: recipient.id,
    prospect_id: recipient.prospect_id,
    event_type: eventType,
    event_data: data,
  })

  // Log to existing activities table
  await supabase.from('activities').insert({
    type: 'email',
    title: `Email ${eventType} — ${recipient.email_campaigns?.name}`,
    status: 'completed',
    prospect_id: recipient.prospect_id,
    completed_at: new Date().toISOString(),
  })

  // Trigger pipeline auto-update
  await autoPipelineUpdate(recipient.prospect_id, eventType)

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
```

---

## Phase B6 — Campaign Service Layer

### File: `src/services/campaignService.ts`

```typescript
import { supabase } from '@/lib/supabase'

// prospect_id must be number (bigint)
export async function addRecipients(
  campaignId: string,
  prospectIds: number[]
) {
  const rows = prospectIds.map((pid) => ({
    campaign_id: campaignId,
    prospect_id: pid,
    status: 'pending',
  }))
  return supabase
    .from('campaign_recipients')
    .upsert(rows, { onConflict: 'campaign_id,prospect_id' })
}

// Use the SQL function for bulk filtered adds
export async function addFilteredProspects(
  campaignId: string,
  filters: {
    country?: string
    industry?: string
    seniority?: string
    limit?: number
  }
) {
  return supabase.rpc('add_filtered_prospects_to_campaign', {
    p_campaign_id: campaignId,
    p_country: filters.country ?? null,
    p_industry: filters.industry ?? null,
    p_seniority: filters.seniority ?? null,
    p_limit: filters.limit ?? 100,
  })
}

export async function getRecipients(campaignId: string) {
  return supabase
    .from('campaign_recipients')
    .select(`
      *,
      prospects (
        id, fullname, firstname, lastname,
        email, company, jobtitle, country,
        status, seniority
      )
    `)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
}

export async function getCampaigns(userId: string) {
  return supabase
    .from('email_campaigns')
    .select('*, email_templates(name, subject)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
}

export async function createCampaign(data: {
  user_id: string
  name: string
  description?: string
  template_id?: string
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
}) {
  return supabase
    .from('email_campaigns')
    .insert(data)
    .select()
    .single()
}

export async function launchCampaign(id: string) {
  return supabase
    .from('email_campaigns')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', id)
}

export async function pauseCampaign(id: string) {
  return supabase
    .from('email_campaigns')
    .update({ status: 'paused' })
    .eq('id', id)
}
```

---

## Phase B7 — Template Service Upgrade

### File: `src/services/templateService.ts` (extend existing)

```typescript
// Use created_by (crm_users.id) — not user_id
export async function getTemplates(createdBy: string) {
  return supabase
    .from('email_templates')
    .select('*')
    .eq('created_by', createdBy)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
}

export async function createTemplate(data: {
  name: string
  category: string
  subject: string
  body: string
  variables: string[]
  created_by: string
}) {
  return supabase
    .from('email_templates')
    .insert(data)
    .select()
    .single()
}

export async function duplicateTemplate(id: string, createdBy: string) {
  const { data: tpl } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (!tpl) throw new Error('Template not found')

  const { id: _, created_at, updated_at, ...rest } = tpl

  return supabase
    .from('email_templates')
    .insert({
      ...rest,
      name: `${tpl.name} (Copy)`,
      created_by: createdBy,
    })
    .select()
    .single()
}

export async function softDeleteTemplate(id: string) {
  return supabase
    .from('email_templates')
    .update({ is_active: false })
    .eq('id', id)
}
```

---

## Phase B8 — Export Column Service

### No new backend needed.

The Export Column Selector (Phase 1 frontend) works entirely client-side:
- Prospects are already fetched/filtered in the frontend
- PapaParse `unparse()` does column filtering before download
- No Supabase changes required

However, for **very large exports (10k+ rows)**, add this SQL function:

```sql
-- Export filtered prospects as CSV-ready JSON (server-side)
CREATE OR REPLACE FUNCTION export_prospects_filtered(
  p_columns text[],
  p_country text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_email_status text DEFAULT NULL,
  p_limit integer DEFAULT 50000
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(filtered))
  INTO result
  FROM (
    SELECT *
    FROM public.prospects p
    WHERE
      p.email IS NOT NULL
      AND p.isactive = true
      AND (p_country IS NULL OR p.country ILIKE p_country)
      AND (p_industry IS NULL OR p.industry ILIKE p_industry)
      AND (p_email_status IS NULL OR p.emailcode = p_email_status)
    LIMIT p_limit
  ) filtered;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Phase B9 — Pipeline Auto-Update Logic

### Inside `resend-webhook` Edge Function

```typescript
// deals.prospect_id is integer — pass as number
async function autoPipelineUpdate(
  prospectId: number,
  eventType: string
) {
  // Map email event → deals.stage (existing CHECK constraint values)
  const stageMap: Record<string, string> = {
    sent: 'New Lead',
    opened: 'Contacted',
    clicked: 'Contacted',
    replied: 'Qualified',
  }

  const newStage = stageMap[eventType]
  if (!newStage) return

  // Existing stage priority from deals table CHECK constraint
  const stagePriority = [
    'New Lead',
    'Contacted',
    'Qualified',
    'Proposal Sent',
    'Negotiation',
    'Closed Won',
    'Closed Lost',
  ]

  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id, stage, name')
    .eq('prospect_id', prospectId) // integer FK
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingDeal) {
    const currentIdx = stagePriority.indexOf(existingDeal.stage)
    const newIdx = stagePriority.indexOf(newStage)

    // Only upgrade stage, never downgrade
    if (newIdx > currentIdx) {
      await supabase
        .from('deals')
        .update({
          stage: newStage,
          stage_changed_at: new Date().toISOString(),
        })
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
      name: `${prospect?.company ?? 'Unknown'} — Website Project`,
      prospect_id: prospectId,
      prospect_name: prospect?.fullname ?? prospect?.firstname ?? '',
      company: prospect?.company ?? '',
      stage: 'Qualified',
      value: 0,
      probability: 30,
      expected_close_date: closeDate.toISOString().split('T')[0],
      stage_changed_at: new Date().toISOString(),
    })
  }
}
```

---

## Phase B10 — Scheduled Sender (Cron)

### Enable pg_cron Extension
Supabase Dashboard → Database → Extensions → `pg_cron` → Enable

```sql
-- Trigger send-campaign-batch every hour
SELECT cron.schedule(
  'send-campaign-batch-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url')
             || '/functions/v1/send-campaign-batch',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

---

## Phase B11 — Settings Persistence

### Using Existing `integrations` + `system_settings`

```typescript
// src/services/outreachSettingsService.ts

// Save Resend config (API key never stored in config jsonb)
export async function saveOutreachSettings(
  userId: string,
  settings: OutreachSettings
) {
  return supabase.from('integrations').upsert({
    user_id: userId,
    provider: 'resend',
    label: 'Resend Email Outreach',
    config: settings,
    status: 'active',
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' })
}

export async function getOutreachSettings(userId: string) {
  return supabase
    .from('integrations')
    .select('config')
    .eq('user_id', userId)
    .eq('provider', 'resend')
    .single()
}

// Global settings (unsubscribe text etc.) → system_settings
export async function saveSystemSetting(
  key: string,
  value: string,
  updatedBy: string
) {
  return supabase.from('system_settings').upsert({
    setting_key: key,
    setting_value: value,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'setting_key' })
}
```

---

## Full Integration Checklist

### Database
- [ ] Run Migration 004 — extend email_templates
- [ ] Run Migration 005 — new tables + indexes + triggers
- [ ] Run Migration 005 — add_filtered_prospects_to_campaign function
- [ ] Apply RLS policies (B2)

### Resend Setup
- [ ] Create Resend account at resend.com
- [ ] Purchase lazandev.dev domain
- [ ] Add DNS records for Resend (SPF, DKIM, DMARC)
- [ ] Create Resend API key
- [ ] Store API key in Supabase Vault
- [ ] Configure Resend webhook URL:
  `https://[project].supabase.co/functions/v1/resend-webhook`

### Edge Functions
- [ ] Deploy `send-campaign-batch` (B4)
- [ ] Deploy `resend-webhook` (B5)
- [ ] Set Edge Function environment variables:
  ```
  RESEND_API_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ```

### Service Layer
- [ ] Replace mock campaign data with B6 service functions
- [ ] Replace mock template data with B7 service functions
- [ ] Wire B11 settings to integrations table

### Automation
- [ ] Enable pg_cron in Supabase
- [ ] Schedule hourly batch send job (B10)
- [ ] Wire pipeline auto-update in webhook handler (B9)

---

## Cost Summary

| Service | Free Tier | Cost to Scale |
|---------|-----------|--------------|
| Supabase | 500MB DB + Edge Functions | $25/mo |
| Resend | 3,000 emails/month | $20/mo (50k emails) |
| lazandev.dev domain | — | ~₱680/yr (~₱57/mo) |
| **Starting cost** | **₱0/month** | — |

> At 50 emails/day × 30 days = 1,500 emails/month
> → **100% free on Resend's free tier to start.**
> One client landed = domain pays for itself 50x over.

---

> ⚠️ Backend begins ONLY after ALL 9 frontend phases are complete.
> Execute one phase at a time. Stop and report after each.
> Await explicit "Yes, Proceed" before continuing.
