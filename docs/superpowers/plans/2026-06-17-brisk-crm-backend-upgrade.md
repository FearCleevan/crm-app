# Brisk CRM Backend Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all frontend campaign/template/outreach features to real Supabase data and Resend email delivery, replacing every mock constant with live queries.

**Architecture:** Supabase for database (PostgreSQL + RLS + Edge Functions). Resend for email delivery — API key stored in Supabase Vault, never in client code. All campaign state lives in three new tables (`email_campaigns`, `campaign_recipients`, `email_events`) that extend the existing schema. The service layer (`src/services/`) is the only code that touches Supabase directly — hooks consume services.

**Tech Stack:** Supabase JS SDK v2, Supabase Edge Functions (Deno), Resend Node SDK (via esm.sh), PostgreSQL triggers, pg_cron, React Query (if available) or useState/useEffect.

**Prerequisite:** All 9 frontend phases from `2026-06-17-brisk-crm-frontend-upgrade.md` must be complete and building before starting ANY backend phase.

## Global Constraints

- `prospects.id` is `BIGINT` — TypeScript type is `number`. Never use `BigInt` constructor or `bigint` primitive.
- `deals.prospect_id` is `INTEGER` (FK to bigint) — safe for 51k rows. TypeScript type is `number`.
- `email_templates.created_by` is the FK column (not `user_id`) — use `created_by` everywhere.
- `campaign_recipients.prospect_id` must be declared `BIGINT` (matches `prospects.id`).
- `integrations` table requires a `UNIQUE(user_id, provider)` constraint before any upsert — Migration B1-b adds it.
- Do NOT add a `user_id` column to `email_templates` — the table already uses `created_by`. Migration 004 in the spec incorrectly includes `ADD COLUMN user_id` — skip that line.
- All SQL goes into numbered migration files under `supabase/migrations/`.
- Edge functions go under `supabase/functions/<function-name>/index.ts`.
- Service files go under `src/services/`.
- `npm run build` must pass with zero TypeScript errors after every task.
- Test each task with `npm run build` then manual browser verification in `npm run dev`.

---

## File Map

| File | Action | Responsible for |
|---|---|---|
| `supabase/migrations/004_extend_email_templates.sql` | **Create** | Add `variables` column, extend category CHECK, skip `user_id` |
| `supabase/migrations/005_campaign_tables.sql` | **Create** | `email_campaigns`, `campaign_recipients`, `email_events`, indexes, triggers, SQL functions |
| `supabase/migrations/006_rls_policies.sql` | **Create** | RLS on all new tables + `email_templates` policy |
| `supabase/migrations/007_integrations_unique.sql` | **Create** | `UNIQUE(user_id, provider)` constraint on `integrations` |
| `supabase/functions/send-campaign-batch/index.ts` | **Create** | Hourly batch sender Edge Function |
| `supabase/functions/resend-webhook/index.ts` | **Create** | Webhook receiver for Resend email events |
| `src/services/campaignService.ts` | **Create** | All `email_campaigns` + `campaign_recipients` queries |
| `src/services/templateService.ts` | **Create** (extend existing if present) | Template CRUD using `created_by` |
| `src/services/outreachSettingsService.ts` | **Create** | `integrations` + `system_settings` upsert/read |
| `src/hooks/useCampaigns.ts` | **Create** | React hook wrapping `campaignService` |
| `src/hooks/useTemplates.ts` | **Create** | React hook wrapping `templateService` |
| `src/hooks/useOutreachSettings.ts` | **Create** | React hook wrapping `outreachSettingsService` |
| `src/pages/EmailsPage.tsx` | **Modify** | Replace mock state with live hooks |
| `src/components/settings/EmailOutreachTab.tsx` | **Modify** | Wire to `useOutreachSettings` |
| `src/types/campaigns.ts` | **Create** | Shared TypeScript interfaces for all campaign entities |

---

## Task B1: Schema Migrations

**Files:**
- Create: `supabase/migrations/004_extend_email_templates.sql`
- Create: `supabase/migrations/005_campaign_tables.sql`
- Create: `supabase/migrations/007_integrations_unique.sql`

**Interfaces:**
- Produces: `email_campaigns`, `campaign_recipients`, `email_events` tables; `add_filtered_prospects_to_campaign()` SQL function; `variables` column on `email_templates`

- [ ] **Create the migrations directory if it doesn't exist**

```bash
mkdir -p supabase/migrations
```

- [ ] **Create Migration 004 — extend email_templates**

```sql
-- supabase/migrations/004_extend_email_templates.sql
-- NOTE: We do NOT add user_id — the table already uses created_by (uuid → crm_users.id)
-- This migration only adds the variables column and extends the category CHECK.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Extend category CHECK to include cold outreach types
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

- [ ] **Create Migration 005 — new tables**

```sql
-- supabase/migrations/005_campaign_tables.sql

-- =============================================
-- TABLE: email_campaigns
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.crm_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_id uuid
    REFERENCES public.email_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft','active','paused','completed'])),
  daily_limit integer NOT NULL DEFAULT 50
    CHECK (daily_limit >= 10 AND daily_limit <= 500),
  send_from_hour integer NOT NULL DEFAULT 9
    CHECK (send_from_hour >= 0 AND send_from_hour <= 23),
  send_to_hour integer NOT NULL DEFAULT 17
    CHECK (send_to_hour >= 0 AND send_to_hour <= 23),
  send_days text[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  warmup_enabled boolean NOT NULL DEFAULT false,
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
-- prospect_id is bigint — matches prospects.id (bigint)
-- =============================================
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL
    REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  prospect_id bigint NOT NULL
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending','sent','opened','clicked','replied','bounced','unsubscribed'
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
  CONSTRAINT campaign_recipients_unique UNIQUE (campaign_id, prospect_id)
);

-- =============================================
-- TABLE: email_events
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid
    REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid
    REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  prospect_id bigint
    REFERENCES public.prospects(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type = ANY (ARRAY[
      'sent','opened','clicked','replied','bounced','unsubscribed'
    ])),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_events_pkey PRIMARY KEY (id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id     ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status      ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_prospect_id ON public.campaign_recipients(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status  ON public.campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_resend_id
  ON public.campaign_recipients(resend_message_id)
  WHERE resend_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id    ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_prospect_id    ON public.email_events(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type     ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred_at    ON public.email_events(occurred_at DESC);

-- =============================================
-- TRIGGERS
-- =============================================

-- updated_at auto-maintain
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Campaign aggregate counters
CREATE OR REPLACE FUNCTION update_campaign_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status = 'pending' THEN
    UPDATE public.email_campaigns SET total_sent = total_sent + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'opened' AND OLD.status NOT IN ('opened','clicked','replied','bounced') THEN
    UPDATE public.email_campaigns SET total_opened = total_opened + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'clicked' AND OLD.status NOT IN ('clicked','replied','bounced') THEN
    UPDATE public.email_campaigns SET total_clicked = total_clicked + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'replied' AND OLD.status NOT IN ('replied','bounced') THEN
    UPDATE public.email_campaigns SET total_replied = total_replied + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'bounced' AND OLD.status != 'bounced' THEN
    UPDATE public.email_campaigns SET total_bounced = total_bounced + 1
    WHERE id = NEW.campaign_id;

  ELSIF NEW.status = 'unsubscribed' AND OLD.status != 'unsubscribed' THEN
    UPDATE public.email_campaigns SET total_unsubscribed = total_unsubscribed + 1
    WHERE id = NEW.campaign_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campaign_counters ON public.campaign_recipients;
CREATE TRIGGER trg_update_campaign_counters
  AFTER UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_counters();

-- Recipient count
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

DROP TRIGGER IF EXISTS trg_update_recipient_count ON public.campaign_recipients;
CREATE TRIGGER trg_update_recipient_count
  AFTER INSERT OR DELETE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_recipient_count();

-- =============================================
-- SQL FUNCTION: add_filtered_prospects_to_campaign
-- Callable from frontend via supabase.rpc()
-- =============================================
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
    AND (p_country   IS NULL OR p.country   ILIKE p_country)
    AND (p_industry  IS NULL OR p.industry  ILIKE p_industry)
    AND (p_seniority IS NULL OR p.seniority ILIKE p_seniority)
    AND p.id NOT IN (
      SELECT prospect_id FROM public.campaign_recipients
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

- [ ] **Create Migration 007 — integrations unique constraint**

This MUST be applied before any B11 upserts.

```sql
-- supabase/migrations/007_integrations_unique.sql
-- The integrations table has no unique constraint on (user_id, provider).
-- Without this, upsert with onConflict:'user_id,provider' creates duplicates.

ALTER TABLE public.integrations
  ADD CONSTRAINT IF NOT EXISTS integrations_user_provider_unique
  UNIQUE (user_id, provider);
```

- [ ] **Apply migrations in Supabase Dashboard or via CLI**

**Option A — Supabase Dashboard (no CLI):**
1. Open Supabase Dashboard → SQL Editor
2. Paste and run `004_extend_email_templates.sql`
3. Paste and run `005_campaign_tables.sql`
4. Paste and run `007_integrations_unique.sql`

**Option B — Supabase CLI:**
```bash
supabase db push
```

- [ ] **Verify all 3 new tables exist**

In SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('email_campaigns','campaign_recipients','email_events');
```
Expected: 3 rows returned.

- [ ] **Verify triggers are active**

```sql
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name IN (
  'trg_email_campaigns_updated_at',
  'trg_update_campaign_counters',
  'trg_update_recipient_count'
);
```
Expected: 3 rows.

- [ ] **Verify integrations constraint**

```sql
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'integrations'
AND constraint_type = 'UNIQUE';
```
Expected: `integrations_user_provider_unique` appears.

- [ ] **Commit migration files**

```bash
git add supabase/migrations/
git commit -m "feat: migrations 004/005/007 — campaign tables, email_templates extend, integrations unique"
```

---

## Task B2: RLS Policies

**Files:**
- Create: `supabase/migrations/006_rls_policies.sql`

**Interfaces:**
- Produces: Row-level security on `email_campaigns`, `campaign_recipients`, `email_events`, and `email_templates`

- [ ] **Create Migration 006**

```sql
-- supabase/migrations/006_rls_policies.sql

-- Enable RLS on new tables
ALTER TABLE public.email_campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events           ENABLE ROW LEVEL SECURITY;

-- email_campaigns: user manages own campaigns
-- crm_users.auth_id links to auth.uid()
DROP POLICY IF EXISTS "Users manage own campaigns" ON public.email_campaigns;
CREATE POLICY "Users manage own campaigns"
ON public.email_campaigns FOR ALL
USING (
  user_id IN (
    SELECT id FROM public.crm_users
    WHERE auth_id = auth.uid()
  )
);

-- campaign_recipients: accessible if the parent campaign belongs to the user
DROP POLICY IF EXISTS "Users access own campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Users access own campaign recipients"
ON public.campaign_recipients FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id
    FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

-- email_events: accessible if parent campaign belongs to user
DROP POLICY IF EXISTS "Users access own email events" ON public.email_events;
CREATE POLICY "Users access own email events"
ON public.email_events FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id
    FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

-- email_templates: policy using created_by (existing column, not user_id)
DROP POLICY IF EXISTS "Users manage own templates" ON public.email_templates;
CREATE POLICY "Users manage own templates"
ON public.email_templates FOR ALL
USING (
  created_by IN (
    SELECT id FROM public.crm_users
    WHERE auth_id = auth.uid()
  )
);
```

- [ ] **Apply migration in Supabase Dashboard (SQL Editor)**

Paste and run the full content of `006_rls_policies.sql`.

- [ ] **Verify RLS is enabled**

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('email_campaigns','campaign_recipients','email_events','email_templates');
```
Expected: `rowsecurity = true` for all 4 tables.

- [ ] **Verify policies exist**

```sql
SELECT policyname, tablename FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('email_campaigns','campaign_recipients','email_events','email_templates');
```
Expected: 4 policies.

- [ ] **Commit**

```bash
git add supabase/migrations/006_rls_policies.sql
git commit -m "feat: RLS policies for campaign tables and email_templates"
```

---

## Task B3: Resend Setup

**Files:**
- None — all setup is external (Resend dashboard + Supabase Vault SQL)

**Interfaces:**
- Produces: `RESEND_API_KEY` available in Edge Function `Deno.env.get('RESEND_API_KEY')`

- [ ] **Create Resend account**

Go to `resend.com` → Sign up → Free plan covers 3,000 emails/month.

- [ ] **Add and verify your domain**

In Resend Dashboard → Domains → Add Domain → Enter `lazandev.dev` (or your domain).

Resend will give you 3 DNS records to add:

| Type | Host | Value |
|------|------|-------|
| TXT | @ (or `lazandev.dev`) | `v=spf1 include:_spf.resend.com ~all` |
| CNAME | `resend._domainkey` | *(provided by Resend — copy exact value)* |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

Add these in your DNS provider (Namecheap, Cloudflare, etc.), then click "Verify" in Resend. DNS propagation takes 15–60 minutes.

- [ ] **Create Resend API key**

Resend Dashboard → API Keys → Create → Name it `brisk-crm-production` → Copy the key.

- [ ] **Store API key in Supabase Vault**

In Supabase Dashboard → SQL Editor, run:
```sql
SELECT vault.create_secret(
  'YOUR_RESEND_API_KEY_HERE',
  'resend_api_key',
  'Resend API key for Brisk CRM campaign email delivery'
);
```
Replace `YOUR_RESEND_API_KEY_HERE` with the actual key. This stores it encrypted — never in client code.

- [ ] **Configure webhook in Resend**

Resend Dashboard → Webhooks → Add Endpoint:
```
URL: https://[your-project-ref].supabase.co/functions/v1/resend-webhook
Events to subscribe: email.sent, email.opened, email.clicked, email.bounced, email.complained
```

> Note: The actual webhook URL uses your Supabase project reference ID found in Dashboard → Settings → General → Reference ID.

- [ ] **No commit needed for this task** (no code files changed)

---

## Task B4: Edge Function — Send Campaign Batch

**Files:**
- Create: `supabase/functions/send-campaign-batch/index.ts`

**Interfaces:**
- Consumes: `email_campaigns` (status = 'active'), `campaign_recipients` (status = 'pending'), `email_templates`, `crm_users`, `Deno.env.get('RESEND_API_KEY')`, `Deno.env.get('SUPABASE_URL')`, `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- Produces: Updated `campaign_recipients` (status → 'sent'), rows in `email_events`, rows in `activities`

- [ ] **Create the function file**

```bash
mkdir -p supabase/functions/send-campaign-batch
```

- [ ] **Write the function**

```typescript
// supabase/functions/send-campaign-batch/index.ts
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
    .replace(/{{my_name}}/g,      'Peter Lazan')
    .replace(/{{my_portfolio}}/g, 'lazandev.vercel.app')
}

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
        from: `${senderName} <peter@lazandev.dev>`,
        to: prospect.email,
        subject,
        text: body,
      })

      if (!sendError && sent?.id) {
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'sent',
            resend_message_id: sent.id,
            sent_at: new Date().toISOString(),
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
```

- [ ] **Set Edge Function environment variables in Supabase**

Supabase Dashboard → Edge Functions → Manage Secrets → Add:
```
RESEND_API_KEY = [your key from Resend dashboard]
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically injected by Supabase — do not add them manually.

- [ ] **Deploy the function**

```bash
supabase functions deploy send-campaign-batch
```

Or via Dashboard: Edge Functions → Deploy → Upload the file.

- [ ] **Test manually (optional)**

```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/send-campaign-batch \
  -H "Authorization: Bearer [your-anon-key]"
```
Expected response: `{"ok":true,"totalSent":0}` (0 because no active campaigns yet).

- [ ] **Commit**

```bash
git add supabase/functions/send-campaign-batch/
git commit -m "feat: send-campaign-batch edge function"
```

---

## Task B5: Edge Function — Resend Webhook

**Files:**
- Create: `supabase/functions/resend-webhook/index.ts`

**Interfaces:**
- Consumes: Resend webhook POST body (`{ type, data: { email_id, ... } }`), `campaign_recipients` (by `resend_message_id`)
- Produces: Updated `campaign_recipients`, rows in `email_events`, rows in `activities`, updated `deals` via `autoPipelineUpdate`

- [ ] **Create function directory**

```bash
mkdir -p supabase/functions/resend-webhook
```

- [ ] **Write the function**

```typescript
// supabase/functions/resend-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Status priority — webhook must never downgrade a status
const STATUS_PRIORITY = [
  'pending','sent','opened','clicked',
  'replied','bounced','unsubscribed',
]

// deals.stage priority — never downgrade
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

const STAGE_MAP: Record<string, string> = {
  sent:    'New Lead',
  opened:  'Contacted',
  clicked: 'Contacted',
  replied: 'Qualified',
}

async function autoPipelineUpdate(prospectId: number, eventType: string) {
  const newStage = STAGE_MAP[eventType]
  if (!newStage) return

  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id, stage, name')
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
        .update({
          stage:            newStage,
          stage_changed_at: new Date().toISOString(),
        })
        .eq('id', existingDeal.id)
    }
  } else if (eventType === 'replied') {
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

  await supabase.from('email_events').insert({
    campaign_id:  recipient.campaign_id,
    recipient_id: recipient.id,
    prospect_id:  recipient.prospect_id,
    event_type:   eventType,
    event_data:   data,
  })

  await supabase.from('activities').insert({
    type:         'email',
    title:        `Email ${eventType} — ${(recipient as any).email_campaigns?.name ?? 'Campaign'}`,
    status:       'completed',
    prospect_id:  recipient.prospect_id,
    completed_at: new Date().toISOString(),
  })

  await autoPipelineUpdate(Number(recipient.prospect_id), eventType)

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Deploy the function**

```bash
supabase functions deploy resend-webhook
```

- [ ] **Register webhook URL in Resend**

In Resend Dashboard → Webhooks → Edit → set the URL to:
```
https://[project-ref].supabase.co/functions/v1/resend-webhook
```

- [ ] **Commit**

```bash
git add supabase/functions/resend-webhook/
git commit -m "feat: resend-webhook edge function with pipeline auto-update"
```

---

## Task B6: TypeScript Interfaces

**Files:**
- Create: `src/types/campaigns.ts`

**Interfaces:**
- Produces: `Campaign`, `CampaignRecipient`, `EmailEvent` TypeScript types used by all service and hook files

- [ ] **Create the types file**

```typescript
// src/types/campaigns.ts

export interface Campaign {
  id: string
  user_id: string
  name: string
  description: string | null
  template_id: string | null
  status: 'draft' | 'active' | 'paused' | 'completed'
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
  total_recipients: number
  total_sent: number
  total_opened: number
  total_clicked: number
  total_replied: number
  total_bounced: number
  total_unsubscribed: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined
  email_templates?: { name: string; subject: string } | null
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  prospect_id: number  // bigint → number
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
  resend_message_id: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  bounced_at: string | null
  unsubscribed_at: string | null
  created_at: string
  // Joined
  prospects?: {
    id: number
    fullname: string | null
    firstname: string | null
    lastname: string | null
    email: string | null
    company: string | null
    jobtitle: string | null
    country: string | null
    status: string | null
    seniority: string | null
  } | null
}

export interface EmailEvent {
  id: string
  campaign_id: string | null
  recipient_id: string | null
  prospect_id: number | null  // bigint → number
  event_type: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
  event_data: Record<string, unknown>
  occurred_at: string
}

export interface OutreachSettings {
  sender_name: string
  sender_email: string
  daily_limit: number
  send_from_hour: number
  send_to_hour: number
  send_days: string[]
  warmup_enabled: boolean
  unsubscribe_footer: boolean
  unsubscribe_text: string
}
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/types/campaigns.ts
git commit -m "feat: TypeScript types for campaign entities"
```

---

## Task B7: Campaign Service Layer

**Files:**
- Create: `src/services/campaignService.ts`

**Interfaces:**
- Consumes: `src/types/campaigns.ts` → `Campaign`, `CampaignRecipient`
- Produces: `getCampaigns()`, `createCampaign()`, `updateCampaign()`, `deleteCampaign()`, `launchCampaign()`, `pauseCampaign()`, `addRecipients()`, `addFilteredProspects()`, `getRecipients()`, `getCampaignEvents()`

- [ ] **Create the service**

```typescript
// src/services/campaignService.ts
import { supabase } from '@/lib/supabase'
import type { Campaign, CampaignRecipient, EmailEvent } from '@/types/campaigns'

export async function getCampaigns(userId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*, email_templates(name, subject)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Campaign[]
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
}): Promise<Campaign> {
  const { data: result, error } = await supabase
    .from('email_campaigns')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return result as Campaign
}

export async function updateCampaign(
  id: string,
  data: Partial<Omit<Campaign, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function launchCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function pauseCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update({ status: 'paused' })
    .eq('id', id)
  if (error) throw error
}

// prospect_id values are bigint → number
export async function addRecipients(
  campaignId: string,
  prospectIds: number[]
): Promise<void> {
  const rows = prospectIds.map(pid => ({
    campaign_id: campaignId,
    prospect_id: pid,
    status: 'pending',
  }))
  const { error } = await supabase
    .from('campaign_recipients')
    .upsert(rows, { onConflict: 'campaign_id,prospect_id' })
  if (error) throw error
}

export async function addFilteredProspects(
  campaignId: string,
  filters: { country?: string; industry?: string; seniority?: string; limit?: number }
): Promise<number> {
  const { data, error } = await supabase.rpc('add_filtered_prospects_to_campaign', {
    p_campaign_id: campaignId,
    p_country:     filters.country   ?? null,
    p_industry:    filters.industry  ?? null,
    p_seniority:   filters.seniority ?? null,
    p_limit:       filters.limit     ?? 100,
  })
  if (error) throw error
  return data as number
}

export async function getRecipients(campaignId: string): Promise<CampaignRecipient[]> {
  const { data, error } = await supabase
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
  if (error) throw error
  return (data ?? []) as CampaignRecipient[]
}

export async function getCampaignEvents(campaignId: string): Promise<EmailEvent[]> {
  const { data, error } = await supabase
    .from('email_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('occurred_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as EmailEvent[]
}
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/services/campaignService.ts
git commit -m "feat: campaign service layer with Supabase queries"
```

---

## Task B8: Template Service

**Files:**
- Create: `src/services/templateService.ts`

**Interfaces:**
- Consumes: `email_templates` table — uses `created_by`, NOT `user_id`
- Produces: `getTemplates()`, `createTemplate()`, `updateTemplate()`, `duplicateTemplate()`, `softDeleteTemplate()`

- [ ] **Create template service**

```typescript
// src/services/templateService.ts
import { supabase } from '@/lib/supabase'

export interface DBTemplate {
  id: string
  name: string
  category: string
  subject: string
  body: string
  variables: string[]
  is_active: boolean
  created_by: string  // crm_users.id (NOT user_id)
  created_at: string
  updated_at: string
}

// createdBy is crm_users.id (uuid)
export async function getTemplates(createdBy: string): Promise<DBTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('created_by', createdBy)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DBTemplate[]
}

export async function createTemplate(data: {
  name: string
  category: string
  subject: string
  body: string
  variables: string[]
  created_by: string  // crm_users.id
}): Promise<DBTemplate> {
  const { data: result, error } = await supabase
    .from('email_templates')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return result as DBTemplate
}

export async function updateTemplate(
  id: string,
  data: Partial<Pick<DBTemplate, 'name' | 'category' | 'subject' | 'body' | 'variables'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function duplicateTemplate(id: string, createdBy: string): Promise<DBTemplate> {
  const { data: tpl, error: fetchError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError || !tpl) throw fetchError ?? new Error('Template not found')

  const { id: _, created_at, updated_at, ...rest } = tpl
  const { data: copy, error } = await supabase
    .from('email_templates')
    .insert({ ...rest, name: `${tpl.name} (Copy)`, created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  return copy as DBTemplate
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/services/templateService.ts
git commit -m "feat: template service using created_by column"
```

---

## Task B9: Outreach Settings Service

**Files:**
- Create: `src/services/outreachSettingsService.ts`

**Interfaces:**
- Consumes: `integrations` table (`user_id`, `provider = 'resend'`), `system_settings` table
- Produces: `saveOutreachSettings()`, `getOutreachSettings()`, `saveSystemSetting()`, `getSystemSetting()`

- [ ] **Create settings service**

```typescript
// src/services/outreachSettingsService.ts
import { supabase } from '@/lib/supabase'
import type { OutreachSettings } from '@/types/campaigns'

// userId is crm_users.id (uuid)
export async function saveOutreachSettings(
  userId: string,
  settings: OutreachSettings
): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .upsert({
      user_id:       userId,
      provider:      'resend',
      label:         'Resend Email Outreach',
      config:        settings,
      status:        'active',
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })
  if (error) throw error
}

export async function getOutreachSettings(userId: string): Promise<OutreachSettings | null> {
  const { data, error } = await supabase
    .from('integrations')
    .select('config')
    .eq('user_id', userId)
    .eq('provider', 'resend')
    .single()
  if (error) return null
  return data?.config as OutreachSettings | null
}

// key examples: 'unsubscribe_text', 'outreach_enabled'
export async function saveSystemSetting(
  key: string,
  value: string,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key:   key,
      setting_value: value,
      updated_by:    updatedBy,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'setting_key' })
  if (error) throw error
}

export async function getSystemSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .single()
  return data?.setting_value ?? null
}
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/services/outreachSettingsService.ts
git commit -m "feat: outreach settings service using integrations and system_settings"
```

---

## Task B10: React Hooks

**Files:**
- Create: `src/hooks/useCampaigns.ts`
- Create: `src/hooks/useTemplates.ts`
- Create: `src/hooks/useOutreachSettings.ts`

**Interfaces:**
- Consumes: `campaignService`, `templateService`, `outreachSettingsService`
- Produces: React state + mutation helpers consumed by `EmailsPage` and `EmailOutreachTab`

- [ ] **Create useCampaigns**

```typescript
// src/hooks/useCampaigns.ts
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import * as campaignService from '@/services/campaignService'
import type { Campaign } from '@/types/campaigns'

export function useCampaigns() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const data = await campaignService.getCampaigns(profile.id)
      setCampaigns(data)
    } catch (e) {
      setError(String(e))
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const createCampaign = useCallback(async (data: Parameters<typeof campaignService.createCampaign>[0]) => {
    if (!profile?.id) return
    try {
      const campaign = await campaignService.createCampaign({ ...data, user_id: profile.id })
      setCampaigns(prev => [campaign, ...prev])
      toast.success(campaign.status === 'active' ? 'Campaign launched!' : 'Campaign saved as draft')
      return campaign
    } catch {
      toast.error('Failed to create campaign')
    }
  }, [profile?.id])

  const deleteCampaign = useCallback(async (id: string) => {
    try {
      await campaignService.deleteCampaign(id)
      setCampaigns(prev => prev.filter(c => c.id !== id))
      toast.success('Campaign deleted')
    } catch {
      toast.error('Failed to delete campaign')
    }
  }, [])

  const togglePause = useCallback(async (id: string) => {
    const campaign = campaigns.find(c => c.id === id)
    if (!campaign) return
    try {
      if (campaign.status === 'active') {
        await campaignService.pauseCampaign(id)
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'paused' } : c))
      } else {
        await campaignService.launchCampaign(id)
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'active' } : c))
      }
    } catch {
      toast.error('Failed to update campaign status')
    }
  }, [campaigns])

  const addRecipients = useCallback(async (campaignId: string, prospectIds: number[]) => {
    try {
      await campaignService.addRecipients(campaignId, prospectIds)
      toast.success(`${prospectIds.length} prospects added to campaign`)
      fetchCampaigns()
    } catch {
      toast.error('Failed to add prospects')
    }
  }, [fetchCampaigns])

  return { campaigns, loading, error, createCampaign, deleteCampaign, togglePause, addRecipients }
}
```

- [ ] **Create useTemplates**

```typescript
// src/hooks/useTemplates.ts
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import * as templateService from '@/services/templateService'
import type { DBTemplate } from '@/services/templateService'

export function useTemplates() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState<DBTemplate[]>([])
  const [loading, setLoading]     = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const data = await templateService.getTemplates(profile.id)
      setTemplates(data)
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const addTemplate = useCallback(async (data: Omit<DBTemplate, 'id' | 'is_active' | 'created_at' | 'updated_at' | 'created_by'>) => {
    if (!profile?.id) return
    try {
      const tpl = await templateService.createTemplate({ ...data, created_by: profile.id })
      setTemplates(prev => [tpl, ...prev])
      toast.success('Template created')
    } catch {
      toast.error('Failed to create template')
    }
  }, [profile?.id])

  const updateTemplate = useCallback(async (id: string, data: Parameters<typeof templateService.updateTemplate>[1]) => {
    try {
      await templateService.updateTemplate(id, data)
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
      toast.success('Template updated')
    } catch {
      toast.error('Failed to update template')
    }
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      await templateService.softDeleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template deleted')
    } catch {
      toast.error('Failed to delete template')
    }
  }, [])

  const duplicateTemplate = useCallback(async (id: string) => {
    if (!profile?.id) return
    try {
      const copy = await templateService.duplicateTemplate(id, profile.id)
      setTemplates(prev => [copy, ...prev])
      toast.success('Template duplicated')
    } catch {
      toast.error('Failed to duplicate template')
    }
  }, [profile?.id])

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate }
}
```

- [ ] **Create useOutreachSettings**

```typescript
// src/hooks/useOutreachSettings.ts
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import * as settingsService from '@/services/outreachSettingsService'
import type { OutreachSettings } from '@/types/campaigns'

const DEFAULT_SETTINGS: OutreachSettings = {
  sender_name:        'Peter Lazan',
  sender_email:       'peter@lazandev.dev',
  daily_limit:        50,
  send_from_hour:     9,
  send_to_hour:       17,
  send_days:          ['Mon','Tue','Wed','Thu','Fri'],
  warmup_enabled:     false,
  unsubscribe_footer: true,
  unsubscribe_text:   'To unsubscribe from these emails, reply with "unsubscribe".',
}

export function useOutreachSettings() {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<OutreachSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    setLoading(true)
    settingsService.getOutreachSettings(profile.id)
      .then(data => { if (data) setSettings(data) })
      .finally(() => setLoading(false))
  }, [profile?.id])

  const save = useCallback(async (data: OutreachSettings) => {
    if (!profile?.id) return
    setSaving(true)
    try {
      await settingsService.saveOutreachSettings(profile.id, data)
      setSettings(data)
      toast.success('Outreach settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [profile?.id])

  return { settings, loading, saving, save }
}
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/hooks/useCampaigns.ts src/hooks/useTemplates.ts src/hooks/useOutreachSettings.ts
git commit -m "feat: react hooks for campaigns, templates, outreach settings"
```

---

## Task B11: Wire EmailsPage to Live Data

**Files:**
- Modify: `src/pages/EmailsPage.tsx`

**Interfaces:**
- Replaces: `MOCK_CAMPAIGNS` and `MOCK_RICH_TEMPLATES` local state with `useCampaigns()` and `useTemplates()` hooks

- [ ] **Replace mock state in EmailsPage**

Read `src/pages/EmailsPage.tsx`, then make the following changes:

1. **Add hook imports** at the top:
```tsx
import { useCampaigns } from '@/hooks/useCampaigns'
import { useTemplates } from '@/hooks/useTemplates'
```

2. **Remove** the `useState<MockCampaign[]>(MOCK_CAMPAIGNS)` block and replace with:
```tsx
const { campaigns, loading: campaignsLoading, createCampaign, deleteCampaign, togglePause, addRecipients } = useCampaigns()
```

3. **Remove** the `useTemplatesState()` local state hook and replace with:
```tsx
const { templates, loading: templatesLoading, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useTemplates()
```

4. **Update CampaignListView props** — the `onDelete` and `onTogglePause` props now call the live hooks:
```tsx
<CampaignListView
  campaigns={campaigns}
  onNew={() => { setEditingCampaign(null); setWizardOpen(true) }}
  onEdit={c => { setEditingCampaign(c as any); setWizardOpen(true) }}
  onView={c => setViewingCampaignId(c.id)}
  onDelete={deleteCampaign}
  onTogglePause={togglePause}
/>
```

5. **Update CreateCampaignWizard onSave** to call `createCampaign` (which is now async):
```tsx
onSave={async (campaign) => {
  await createCampaign({
    name:           campaign.name,
    status:         campaign.status,
    daily_limit:    50,
    send_from_hour: 9,
    send_to_hour:   17,
    send_days:      ['Mon','Tue','Wed','Thu','Fri'],
    warmup_enabled: false,
  })
  setWizardOpen(false)
}}
```

6. **Update TemplateManager props** — now using live hooks:
```tsx
<TemplateManager
  templates={templates.map(t => ({
    id:        t.id,
    name:      t.name,
    category:  t.category,
    subject:   t.subject,
    body:      t.body,
    variables: t.variables as string[],
    updatedAt: t.updated_at,
  }))}
  onAdd={d => addTemplate({ name: d.name, category: d.category, subject: d.subject, body: d.body, variables: d.variables ?? [] })}
  onUpdate={(id, d) => updateTemplate(id, { name: d.name, category: d.category, subject: d.subject, body: d.body, variables: d.variables })}
  onDelete={deleteTemplate}
  onDuplicate={t => duplicateTemplate(t.id)}
/>
```

7. **Remove unused imports** for `MOCK_CAMPAIGNS` and `MOCK_RICH_TEMPLATES`.

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Manual test in browser**

```bash
npm run dev
```

Open `http://localhost:5173` → Emails → Campaigns tab. With a Supabase connection established, the list should load empty (no campaigns yet). Create one via wizard — it should appear after save.

- [ ] **Commit**

```bash
git add src/pages/EmailsPage.tsx
git commit -m "feat: wire EmailsPage to live Supabase campaign and template data"
```

---

## Task B12: Wire EmailOutreachTab to Live Settings

**Files:**
- Modify: `src/components/settings/EmailOutreachTab.tsx`

- [ ] **Replace local state with useOutreachSettings hook**

In `EmailOutreachTab.tsx`:

1. Add import:
```tsx
import { useOutreachSettings } from '@/hooks/useOutreachSettings'
```

2. Replace all the individual `useState` calls for settings fields with:
```tsx
const { settings, loading, saving, save } = useOutreachSettings()
const [local, setLocal] = React.useState(settings)
React.useEffect(() => setLocal(settings), [settings])
```

3. Replace all `setSenderName(...)` etc. individual setters with:
```tsx
setLocal(prev => ({ ...prev, sender_name: e.target.value }))
// (and similar for each field using the OutreachSettings key names)
```

4. Replace `handleSave` with:
```tsx
async function handleSave() {
  if (local.send_from_hour >= local.send_to_hour) {
    toast.error('Send window start must be before end time.')
    return
  }
  await save(local)
}
```

5. Show loading skeleton while `loading` is true:
```tsx
if (loading) return <div className="h-48 flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading settings…</p></div>
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/components/settings/EmailOutreachTab.tsx
git commit -m "feat: wire EmailOutreachTab to live outreach settings persistence"
```

---

## Task B13: Scheduled Sender (pg_cron)

**Files:**
- None — SQL only, run in Supabase Dashboard

**Interfaces:**
- Produces: hourly cron job that calls the `send-campaign-batch` Edge Function

- [ ] **Enable pg_cron extension**

Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable.

- [ ] **Enable pg_net extension** (required for HTTP calls from cron)

Supabase Dashboard → Database → Extensions → search "pg_net" → Enable.

- [ ] **Schedule the job**

In Supabase SQL Editor, run:
```sql
SELECT cron.schedule(
  'send-campaign-batch-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url     := current_setting('app.supabase_url')
                 || '/functions/v1/send-campaign-batch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

> **Note:** `current_setting('app.supabase_url')` requires the app config to be set. Alternatively, hard-code the URL:
> Replace `current_setting('app.supabase_url')` with `'https://[project-ref].supabase.co'`

- [ ] **Verify the job is scheduled**

```sql
SELECT jobname, schedule, command FROM cron.job;
```
Expected: one row with `send-campaign-batch-hourly`.

- [ ] **No code commit needed for this task** (SQL only)

---

## Task B14: Export SQL Function (Large Exports)

**Files:**
- Create: `supabase/migrations/008_export_function.sql`

**Interfaces:**
- Produces: `export_prospects_filtered()` SQL function callable via `supabase.rpc()`
- This is optional — only needed when the export page needs to handle 10k+ rows from the server

- [ ] **Create the migration**

```sql
-- supabase/migrations/008_export_function.sql
-- Server-side export for large prospect sets (10k+ rows).
-- The frontend ExportColumnModal uses client-side PapaParse for normal exports.
-- This function is only called when the user selects "Export All" on filtered views.

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
      AND (p_country      IS NULL OR p.country   ILIKE p_country)
      AND (p_industry     IS NULL OR p.industry  ILIKE p_industry)
      AND (p_email_status IS NULL OR p.emailcode  = p_email_status)
    LIMIT p_limit
  ) filtered;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Apply in Supabase SQL Editor**

Paste and run `008_export_function.sql`.

- [ ] **Commit migration**

```bash
git add supabase/migrations/008_export_function.sql
git commit -m "feat: server-side export function for large prospect sets"
```

---

## Final Integration Checklist

### Database
- [ ] Migration 004 applied — `email_templates.variables` column + category CHECK extended
- [ ] Migration 005 applied — `email_campaigns`, `campaign_recipients`, `email_events`, indexes, triggers, `add_filtered_prospects_to_campaign` function
- [ ] Migration 006 applied — RLS policies on all new tables
- [ ] Migration 007 applied — `integrations(user_id, provider)` unique constraint
- [ ] Migration 008 applied — `export_prospects_filtered` function (optional)

### Resend
- [ ] Resend account created
- [ ] Domain verified (SPF, DKIM, DMARC DNS records added)
- [ ] API key stored in Supabase Vault: `SELECT vault.create_secret(...)`
- [ ] Webhook endpoint configured in Resend Dashboard

### Edge Functions
- [ ] `send-campaign-batch` deployed
- [ ] `resend-webhook` deployed
- [ ] `RESEND_API_KEY` secret set in Edge Function settings

### Service Layer
- [ ] `campaignService.ts` created
- [ ] `templateService.ts` created
- [ ] `outreachSettingsService.ts` created
- [ ] All three hooks created (`useCampaigns`, `useTemplates`, `useOutreachSettings`)
- [ ] `EmailsPage.tsx` wired to live hooks (mock data removed)
- [ ] `EmailOutreachTab.tsx` wired to `useOutreachSettings`

### Automation
- [ ] `pg_cron` extension enabled
- [ ] `pg_net` extension enabled
- [ ] Hourly batch send job scheduled

### Cost check
- 50 emails/day × 30 days = **1,500 emails/month → free on Resend**
- One client landed → domain pays for itself 50x

---

## Notes on `profile.id` vs `auth.uid()`

`useAuth()` returns `profile` which is from the `crm_users` table. `profile.id` is the `crm_users.id` (uuid) — this is what `email_campaigns.user_id` and `email_templates.created_by` reference.

`auth.uid()` is `auth.users.id` — the same as `crm_users.auth_id`. The service layer uses `profile.id` (crm_users primary key) for all inserts.

If `useAuth()` doesn't expose `profile`, read `src/context/AuthContext.tsx` to find the correct way to get `crm_users.id` from the hook's return value.
