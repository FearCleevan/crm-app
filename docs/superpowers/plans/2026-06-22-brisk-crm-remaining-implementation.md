# Brisk CRM — Remaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the one remaining frontend phase (Phase 7 — Email Compose Upgrade) then wire all 9 frontend features to real Supabase data and Resend email delivery, replacing every mock constant with live queries.

**Architecture:** Frontend Phase 7 adds a template picker, prospect linker, variable preview, and schedule-send toggle to the existing `ComposeModal`. Backend wiring creates 3 new Supabase tables (`email_campaigns`, `campaign_recipients`, `email_events`), 2 Edge Functions (`send-campaign-batch`, `resend-webhook`), a service layer (`src/services/`), and React hooks that replace all mock constants currently used by `EmailsPage`, `SettingsPage`, and the campaign components.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind CSS v3, shadcn/ui, Recharts, Sonner, React Hook Form + Zod, Supabase JS SDK v2, Supabase Edge Functions (Deno), Resend email API, pg_cron.

---

## Codebase Audit — What Is Done vs. What Remains

### Frontend — STATUS AS OF 2026-06-22

| Phase | Feature | Status | Key Files |
|-------|---------|--------|-----------|
| Pre-Phase | `campaign-utils.ts` helpers | ✅ DONE | `src/lib/campaign-utils.ts` |
| Phase 1 | Export Column Selector | ✅ DONE | `src/components/prospects/ExportColumnModal.tsx` |
| Phase 2 | Campaign List Page | ✅ DONE | `src/components/emails/CampaignListView.tsx` |
| Phase 3 | Template Manager Upgrade | ✅ DONE | `TemplateManager.tsx`, `TemplateCard.tsx`, `TemplateModal.tsx`, `VariableChips.tsx` |
| Phase 4 | Create Campaign Wizard | ✅ DONE | `src/components/emails/CreateCampaignWizard.tsx` |
| Phase 5 | Prospect Selector | ✅ DONE | `ProspectSelector.tsx`, `useProspectSelection.ts` |
| Phase 6 | Campaign Detail & Stats | ✅ DONE | `src/components/emails/CampaignDetailView.tsx` |
| **Phase 7** | **Email Compose Upgrade** | **❌ NOT DONE** | `ComposeModal.tsx` exists but has NO template picker, prospect linker, variable preview, or schedule-send |
| Phase 8 | Sending Schedule UI | ✅ DONE | `src/components/settings/EmailOutreachTab.tsx` |
| Phase 9 | Pipeline Auto-Update UI | ✅ DONE | `CampaignActivityFeed.tsx`, `CampaignBadge.tsx`, `DealCard.tsx`, `ProspectsTable.tsx`, `ProspectDetailSheet.tsx` |

### Backend — STATUS AS OF 2026-06-22

| Phase | Feature | Status | Notes |
|-------|---------|--------|-------|
| B1 | Schema Migrations | ❌ NOT DONE | No `supabase/` folder exists in the repo |
| B2 | RLS Policies | ❌ NOT DONE | |
| B3 | Resend Setup | ❌ NOT DONE | External steps (account, domain, vault) |
| B4 | Edge Function: Send Batch | ❌ NOT DONE | |
| B5 | Edge Function: Webhooks | ❌ NOT DONE | |
| B6 | TypeScript Interfaces | ❌ NOT DONE | `src/types/campaigns.ts` does not exist |
| B7 | Campaign Service Layer | ❌ NOT DONE | `src/services/campaignService.ts` does not exist |
| B8 | Template Service Upgrade | ❌ NOT DONE | `src/services/templateService.ts` does not exist |
| B9 | Pipeline Auto-Update | ❌ NOT DONE | Lives inside the webhook Edge Function |
| B10 | Scheduled Sender (pg_cron) | ❌ NOT DONE | |
| B11 | Settings Persistence | ❌ NOT DONE | `src/services/outreachSettingsService.ts` does not exist |
| — | Wire frontend hooks | ❌ NOT DONE | `useCampaigns`, `useTemplates`, `useOutreachSettings` hooks don't exist; all data is still mock constants |

---

## File Map

### Phase F7 — Frontend Email Compose Upgrade

| File | Action | Responsible for |
|------|--------|-----------------|
| `src/components/emails/ComposeModal.tsx` | **Modify** | Add template picker section, prospect linker field, variable preview toggle, schedule-send option |

### Backend Phases B1–B11

| File | Action | Responsible for |
|------|--------|-----------------|
| `supabase/migrations/004_extend_email_templates.sql` | **Create** | Add `variables jsonb` column, extend category CHECK |
| `supabase/migrations/005_campaign_tables.sql` | **Create** | `email_campaigns`, `campaign_recipients`, `email_events` tables, indexes, triggers, `add_filtered_prospects_to_campaign()` function |
| `supabase/migrations/006_rls_policies.sql` | **Create** | RLS on all new tables + `email_templates` |
| `supabase/migrations/007_integrations_unique.sql` | **Create** | `UNIQUE(user_id, provider)` constraint on `integrations` |
| `supabase/functions/send-campaign-batch/index.ts` | **Create** | Hourly batch email sender Deno Edge Function |
| `supabase/functions/resend-webhook/index.ts` | **Create** | Resend event webhook receiver + pipeline auto-update |
| `src/types/campaigns.ts` | **Create** | Shared TypeScript interfaces: `Campaign`, `CampaignRecipient`, `EmailEvent`, `OutreachSettings` |
| `src/services/campaignService.ts` | **Create** | All `email_campaigns` + `campaign_recipients` Supabase queries |
| `src/services/templateService.ts` | **Create** | Template CRUD using `created_by` (not `user_id`) |
| `src/services/outreachSettingsService.ts` | **Create** | `integrations` + `system_settings` upsert/read |
| `src/hooks/useCampaigns.ts` | **Create** | React hook wrapping `campaignService` with loading/error state |
| `src/hooks/useTemplates.ts` | **Create** | React hook wrapping `templateService` |
| `src/hooks/useOutreachSettings.ts` | **Create** | React hook wrapping `outreachSettingsService` |
| `src/pages/EmailsPage.tsx` | **Modify** | Replace `MOCK_CAMPAIGNS`, `MOCK_RICH_TEMPLATES` with live hooks |
| `src/components/settings/EmailOutreachTab.tsx` | **Modify** | Wire to `useOutreachSettings` — persist/load real settings |

---

## SECTION 1: Frontend Phase 7 — Email Compose Upgrade

### Task F7: Upgrade ComposeModal with Template Picker, Prospect Linker, Variable Preview, Schedule Send

**Files:**
- Modify: `src/components/emails/ComposeModal.tsx`

**What exists today:** `ComposeModal.tsx` has a full email chip input, CC/BCC, subject, body (`EmailEditor`), attach, and send. There is NO template picker, NO prospect linker, NO variable preview toggle, NO schedule-send.

**What to add:**
1. Template Picker dropdown at top — "Use a template…" — fills subject + body on select
2. Prospect Linker field — "To (Prospect)" — searches real prospects via `useProspects`, sets To email
3. Variable Preview toggle — renders body with `{{vars}}` resolved using linked prospect; unresolved vars in orange
4. Schedule Send option — date + time picker; stores locally as state; shows clock icon in send button

- [ ] **Read the current ComposeModal to understand exact structure**

Open `src/components/emails/ComposeModal.tsx` and note:
- The `EmailChipInput` for To/CC/BCC chips (lines ~1-120)
- The main modal structure and state (lines ~120+)
- Where subject and body state live
- The send button and `emailService.sendEmail()` call

- [ ] **Add template state and picker UI**

In `ComposeModal.tsx`, add these imports at the top:

```typescript
import { MOCK_RICH_TEMPLATES, type RichTemplate } from '@/constants/mockEmails'
```

Add state inside the component body (after existing state declarations):

```typescript
const [selectedTemplate, setSelectedTemplate] = useState<RichTemplate | null>(null)
const [linkedProspect,   setLinkedProspect]   = useState<{ fullname: string; email: string; firstname?: string; company?: string } | null>(null)
const [previewMode,      setPreviewMode]       = useState(false)
const [scheduledAt,      setScheduledAt]       = useState<string>('')
const [showSchedule,     setShowSchedule]      = useState(false)
```

Add a helper to resolve template variables with prospect data:

```typescript
function resolveVars(text: string, prospect: typeof linkedProspect): string {
  if (!prospect) return text
  return text
    .replace(/{{first_name}}/g,   prospect.firstname ?? '')
    .replace(/{{full_name}}/g,    prospect.fullname  ?? '')
    .replace(/{{company}}/g,      prospect.company   ?? 'your company')
    .replace(/{{my_name}}/g,      'Peter Lazan')
    .replace(/{{my_portfolio}}/g, 'lazandev.vercel.app')
}
```

Add a template picker section **above the Subject input** in the JSX. Find the subject field and insert this block immediately before it:

```tsx
{/* Template Picker */}
<div className="px-4 pt-3 pb-0">
  <select
    aria-label="Use a template"
    value={selectedTemplate?.id ?? ''}
    onChange={e => {
      const tpl = MOCK_RICH_TEMPLATES.find(t => t.id === e.target.value) ?? null
      setSelectedTemplate(tpl)
      if (tpl) {
        setSubject(tpl.subject)
        setBody(resolveVars(tpl.body, linkedProspect))
        toast.success('Template applied')
      }
    }}
    className="w-full h-8 px-3 rounded-lg border border-input bg-background text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
  >
    <option value="">Use a template…</option>
    {MOCK_RICH_TEMPLATES.map(t => (
      <option key={t.id} value={t.id}>{t.name}</option>
    ))}
  </select>
</div>
```

> Note: `setSubject` and `setBody` must be the existing state setters. If the component uses `emailService` directly with local state for subject/body, find the exact variable names and use those. If body is controlled by `EmailEditor` via a prop, pass the template body to it as an `initialValue`.

- [ ] **Add Prospect Linker field**

Add a prospect search field **above the To field** in the JSX (or replace the prospect suggestion logic already in the To chip input). Add a separate "Link Prospect" row:

```tsx
{/* Prospect Linker */}
<div className="px-4 pt-2 flex items-center gap-2 border-b border-border pb-2">
  <span className="text-xs text-muted-foreground w-16 shrink-0">Prospect</span>
  <div className="relative flex-1">
    <input
      type="text"
      aria-label="Link prospect"
      placeholder="Search prospect by name or email…"
      value={linkedProspect?.fullname ?? ''}
      onChange={e => {
        if (!e.target.value) setLinkedProspect(null)
      }}
      className="w-full h-7 px-3 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      readOnly={!!linkedProspect}
    />
    {linkedProspect && (
      <button
        type="button"
        aria-label="Unlink prospect"
        onClick={() => setLinkedProspect(null)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </div>
  {linkedProspect && (
    <span className="text-[10px] text-muted-foreground">→ {linkedProspect.email}</span>
  )}
</div>
```

> For Phase 7 (frontend-only), the prospect linker uses `MOCK_PROSPECTS` from `src/constants/mockData.ts` (already imported in `ComposeModal.tsx`). When the user types, filter `MOCK_PROSPECTS` and show a dropdown. On select, `setLinkedProspect` with the prospect data and also push their email into the To chip list.

Add the search dropdown logic:

```typescript
const [prospectSearch, setProspectSearch] = useState('')
const prospectSuggestions = prospectSearch.length > 1
  ? MOCK_PROSPECTS.filter(p =>
      (p.fullname + p.email + p.company).toLowerCase().includes(prospectSearch.toLowerCase())
    ).slice(0, 6)
  : []
```

Update the Prospect Linker input to use `prospectSearch`:

```tsx
value={linkedProspect ? linkedProspect.fullname : prospectSearch}
onChange={e => {
  if (linkedProspect) return
  setProspectSearch(e.target.value)
}}
```

Add the dropdown below the input:

```tsx
{!linkedProspect && prospectSuggestions.length > 0 && (
  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
    {prospectSuggestions.map(p => (
      <button
        key={p.id}
        type="button"
        onMouseDown={e => {
          e.preventDefault()
          setLinkedProspect({ fullname: p.fullname, email: p.email, firstname: p.firstname, company: p.company })
          setProspectSearch('')
          // Auto-add email to To chips
          if (p.email && !toChips.includes(p.email)) {
            setToChips(prev => [...prev, p.email])
          }
          // Re-resolve template vars if a template is selected
          if (selectedTemplate) {
            setBody(resolveVars(selectedTemplate.body, { fullname: p.fullname, email: p.email, firstname: p.firstname, company: p.company }))
          }
        }}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-accent text-left text-xs"
      >
        <span className="font-medium text-foreground">{p.fullname}</span>
        <span className="text-muted-foreground">{p.email}</span>
        <span className="text-muted-foreground ml-auto">{p.company}</span>
      </button>
    ))}
  </div>
)}
```

> `toChips` and `setToChips` are the existing state variables for the To field chips — use the exact names from the file.

- [ ] **Add Variable Preview toggle**

Find the toolbar area of the compose modal (near the attach/send buttons or above the body). Add a preview toggle:

```tsx
{/* Variable Preview toggle — only show when template selected */}
{selectedTemplate && (
  <button
    type="button"
    aria-label={previewMode ? 'Edit mode' : 'Preview mode'}
    onClick={() => setPreviewMode(p => !p)}
    className={`flex items-center gap-1.5 h-7 px-3 rounded-lg border text-[11px] font-medium transition-colors ${
      previewMode
        ? 'bg-primary text-primary-foreground border-primary'
        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
    }`}
  >
    {previewMode ? 'Editing' : 'Preview'}
  </button>
)}
```

In the body area of the compose modal, replace the body display with a conditional:

```tsx
{previewMode ? (
  <div
    className="flex-1 p-3 text-xs text-foreground whitespace-pre-wrap overflow-y-auto"
    dangerouslySetInnerHTML={{
      __html: resolveVars(body, linkedProspect)
        .replace(/{{[^}]+}}/g, match =>
          `<span style="color: orange; font-weight: 600;">${match}</span>`
        )
        .replace(/\n/g, '<br/>')
    }}
  />
) : (
  /* existing EmailEditor / textarea here */
)}
```

- [ ] **Add Schedule Send option**

Find the send button row at the bottom of the modal. Add a schedule toggle next to the Send button:

```tsx
{/* Schedule Send */}
<div className="flex items-center gap-2">
  <button
    type="button"
    aria-label="Schedule send"
    onClick={() => setShowSchedule(s => !s)}
    className={`h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
      showSchedule ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'border-border text-muted-foreground hover:bg-accent'
    }`}
  >
    <Clock className="h-3.5 w-3.5" />
    {scheduledAt ? `Scheduled` : 'Schedule'}
  </button>

  {showSchedule && (
    <input
      type="datetime-local"
      aria-label="Schedule date and time"
      value={scheduledAt}
      onChange={e => setScheduledAt(e.target.value)}
      className="h-8 px-3 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  )}
</div>
```

Update the send button label when scheduled:

```tsx
<button
  type="button"
  onClick={handleSend}
  className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
>
  {scheduledAt ? <Clock className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
  {scheduledAt ? 'Schedule Send' : 'Send'}
</button>
```

In the existing `handleSend` function, add at the top:

```typescript
if (scheduledAt) {
  toast.success(`Email scheduled for ${new Date(scheduledAt).toLocaleString()}`)
  onClose?.()
  return
}
```

> This is frontend-only — no actual scheduled delivery in this phase.

- [ ] **Run build and fix any TypeScript errors**

```bash
npm run build
```

Expected: zero TypeScript errors. Fix any type mismatch on `MOCK_PROSPECTS` fields (e.g. `firstname` might be `first_name` in the mock data — check `src/constants/mockData.ts` and match field names exactly).

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add src/components/emails/ComposeModal.tsx
git commit -m "feat: email compose upgrade — template picker, prospect linker, variable preview, schedule send"
```

---

## SECTION 2: Backend — Database Migrations

### Task B1: Schema Migrations

**Files:**
- Create: `supabase/migrations/004_extend_email_templates.sql`
- Create: `supabase/migrations/005_campaign_tables.sql`
- Create: `supabase/migrations/007_integrations_unique.sql`

**Critical constraints:**
- Do NOT add `user_id` to `email_templates` — the table already has `created_by` (uuid → crm_users.id)
- `campaign_recipients.prospect_id` must be `BIGINT` (matches `prospects.id`)
- `deals.prospect_id` is `INTEGER` (safe FK, 51k rows max)

- [ ] **Create the migrations directory**

```powershell
New-Item -ItemType Directory -Force -Path supabase\migrations
```

- [ ] **Create Migration 004 — extend email_templates**

Create file `supabase/migrations/004_extend_email_templates.sql`:

```sql
-- Add variables column only. We do NOT add user_id — this table already uses created_by.
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Extend category CHECK to include cold outreach types
ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_category_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_category_check
  CHECK (category = ANY (ARRAY[
    'general','follow_up','introduction','proposal','closing',
    're_engagement','newsletter','cold_outreach','no_website','outdated_website'
  ]));
```

- [ ] **Create Migration 005 — new tables, indexes, triggers, SQL function**

Create file `supabase/migrations/005_campaign_tables.sql`:

```sql
-- TABLE: email_campaigns
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

-- TABLE: campaign_recipients (prospect_id is BIGINT — matches prospects.id)
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

-- TABLE: email_events
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id      ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status       ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_prospect ON public.campaign_recipients(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status   ON public.campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_resend
  ON public.campaign_recipients(resend_message_id)
  WHERE resend_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_events_campaign        ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_prospect        ON public.email_events(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type            ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_occurred        ON public.email_events(occurred_at DESC);

-- TRIGGER: updated_at
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

-- TRIGGER: campaign aggregate counters
CREATE OR REPLACE FUNCTION update_campaign_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status = 'pending' THEN
    UPDATE public.email_campaigns SET total_sent = total_sent + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'opened' AND OLD.status NOT IN ('opened','clicked','replied','bounced') THEN
    UPDATE public.email_campaigns SET total_opened = total_opened + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'clicked' AND OLD.status NOT IN ('clicked','replied','bounced') THEN
    UPDATE public.email_campaigns SET total_clicked = total_clicked + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'replied' AND OLD.status NOT IN ('replied','bounced') THEN
    UPDATE public.email_campaigns SET total_replied = total_replied + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'bounced' AND OLD.status != 'bounced' THEN
    UPDATE public.email_campaigns SET total_bounced = total_bounced + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.status = 'unsubscribed' AND OLD.status != 'unsubscribed' THEN
    UPDATE public.email_campaigns SET total_unsubscribed = total_unsubscribed + 1 WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campaign_counters ON public.campaign_recipients;
CREATE TRIGGER trg_update_campaign_counters
  AFTER UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_counters();

-- TRIGGER: recipient count
CREATE OR REPLACE FUNCTION update_campaign_recipient_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.email_campaigns
  SET total_recipients = (
    SELECT COUNT(*) FROM public.campaign_recipients WHERE campaign_id = NEW.campaign_id
  )
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_recipient_count ON public.campaign_recipients;
CREATE TRIGGER trg_update_recipient_count
  AFTER INSERT OR DELETE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_campaign_recipient_count();

-- SQL FUNCTION: bulk add filtered prospects to campaign
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
  SELECT p_campaign_id, p.id, 'pending'
  FROM public.prospects p
  WHERE
    p.email IS NOT NULL
    AND p.isactive = true
    AND (p_country   IS NULL OR p.country   ILIKE p_country)
    AND (p_industry  IS NULL OR p.industry  ILIKE p_industry)
    AND (p_seniority IS NULL OR p.seniority ILIKE p_seniority)
    AND p.id NOT IN (
      SELECT prospect_id FROM public.campaign_recipients WHERE campaign_id = p_campaign_id
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

Create file `supabase/migrations/007_integrations_unique.sql`:

```sql
-- Required before any upsert with onConflict:'user_id,provider' on integrations.
ALTER TABLE public.integrations
  ADD CONSTRAINT IF NOT EXISTS integrations_user_provider_unique
  UNIQUE (user_id, provider);
```

- [ ] **Apply all three migrations in Supabase SQL Editor**

In Supabase Dashboard → SQL Editor, run each file in order:
1. `004_extend_email_templates.sql`
2. `005_campaign_tables.sql`
3. `007_integrations_unique.sql`

- [ ] **Verify tables exist**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('email_campaigns','campaign_recipients','email_events');
```
Expected: 3 rows.

- [ ] **Verify triggers are active**

```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name IN (
  'trg_email_campaigns_updated_at',
  'trg_update_campaign_counters',
  'trg_update_recipient_count'
);
```
Expected: 3 rows.

- [ ] **Commit**

```bash
git add supabase/migrations/
git commit -m "feat: migrations 004/005/007 — campaign tables, email_templates extend, integrations unique"
```

---

## Task B2: RLS Policies

**Files:**
- Create: `supabase/migrations/006_rls_policies.sql`

- [ ] **Create Migration 006**

Create file `supabase/migrations/006_rls_policies.sql`:

```sql
ALTER TABLE public.email_campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own campaigns" ON public.email_campaigns;
CREATE POLICY "Users manage own campaigns"
ON public.email_campaigns FOR ALL
USING (
  user_id IN (
    SELECT id FROM public.crm_users WHERE auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users access own campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Users access own campaign recipients"
ON public.campaign_recipients FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users access own email events" ON public.email_events;
CREATE POLICY "Users access own email events"
ON public.email_events FOR ALL
USING (
  campaign_id IN (
    SELECT ec.id FROM public.email_campaigns ec
    JOIN public.crm_users cu ON cu.id = ec.user_id
    WHERE cu.auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users manage own templates" ON public.email_templates;
CREATE POLICY "Users manage own templates"
ON public.email_templates FOR ALL
USING (
  created_by IN (
    SELECT id FROM public.crm_users WHERE auth_id = auth.uid()
  )
);
```

- [ ] **Apply in Supabase SQL Editor**

Paste and run `006_rls_policies.sql`.

- [ ] **Verify RLS is enabled**

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('email_campaigns','campaign_recipients','email_events','email_templates');
```
Expected: `rowsecurity = true` for all 4.

- [ ] **Commit**

```bash
git add supabase/migrations/006_rls_policies.sql
git commit -m "feat: RLS policies for campaign tables and email_templates"
```

---

## Task B3: Resend Account + Domain Setup (External)

**Files:** None — all steps are in external dashboards.

- [ ] **Create Resend account**

Go to `resend.com` → Sign up → Free plan = 3,000 emails/month.

- [ ] **Add and verify domain `lazandev.dev`**

Resend Dashboard → Domains → Add Domain → `lazandev.dev`

Add these DNS records at your domain registrar:

| Type | Host | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:_spf.resend.com ~all` |
| CNAME | `resend._domainkey` | *(Resend provides this value — copy exactly)* |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

Wait 15–60 minutes for DNS propagation, then click Verify in Resend.

- [ ] **Create Resend API key**

Resend Dashboard → API Keys → Create → Name: `brisk-crm-production` → Copy the key.

- [ ] **Store API key in Supabase Vault**

In Supabase Dashboard → SQL Editor:

```sql
SELECT vault.create_secret(
  'YOUR_ACTUAL_RESEND_API_KEY_HERE',
  'resend_api_key',
  'Resend API key for Brisk CRM campaign email delivery'
);
```

Replace `YOUR_ACTUAL_RESEND_API_KEY_HERE` with the real key. Never commit this to git.

- [ ] **Configure webhook in Resend (do this after deploying Edge Function B5)**

Resend Dashboard → Webhooks → Add Endpoint:
```
URL: https://[your-project-ref].supabase.co/functions/v1/resend-webhook
Events: email.sent, email.opened, email.clicked, email.bounced, email.complained
```

Your project ref is at Supabase Dashboard → Settings → General → Reference ID.

---

## Task B4: Edge Function — Send Campaign Batch

**Files:**
- Create: `supabase/functions/send-campaign-batch/index.ts`

- [ ] **Create the directory**

```powershell
New-Item -ItemType Directory -Force -Path supabase\functions\send-campaign-batch
```

- [ ] **Write the function**

Create `supabase/functions/send-campaign-batch/index.ts`:

```typescript
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
        to:   prospect.email,
        subject,
        text: body,
      })

      if (!sendError && sent?.id) {
        await supabase
          .from('campaign_recipients')
          .update({
            status:             'sent',
            resend_message_id:  sent.id,
            sent_at:            new Date().toISOString(),
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

- [ ] **Set RESEND_API_KEY secret in Supabase**

Supabase Dashboard → Edge Functions → Manage Secrets → Add:
```
RESEND_API_KEY = [your key from Resend dashboard]
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — do not add them.

- [ ] **Deploy the function**

```bash
npx supabase functions deploy send-campaign-batch
```

Or upload via Supabase Dashboard → Edge Functions → Deploy.

- [ ] **Smoke test**

```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/send-campaign-batch \
  -H "Authorization: Bearer [your-anon-key]"
```
Expected: `{"ok":true,"totalSent":0}` (0 because no active campaigns yet).

- [ ] **Commit**

```bash
git add supabase/functions/send-campaign-batch/
git commit -m "feat: send-campaign-batch edge function"
```

---

## Task B5: Edge Function — Resend Webhook + Pipeline Auto-Update

**Files:**
- Create: `supabase/functions/resend-webhook/index.ts`

- [ ] **Create the directory**

```powershell
New-Item -ItemType Directory -Force -Path supabase\functions\resend-webhook
```

- [ ] **Write the function**

Create `supabase/functions/resend-webhook/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const STATUS_PRIORITY = ['pending','sent','opened','clicked','replied','bounced','unsubscribed']
const STAGE_PRIORITY  = ['New Lead','Contacted','Qualified','Proposal Sent','Negotiation','Closed Won','Closed Lost']

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
npx supabase functions deploy resend-webhook
```

- [ ] **Register the webhook URL in Resend** (if not done in B3)

Resend Dashboard → Webhooks → set URL to:
```
https://[project-ref].supabase.co/functions/v1/resend-webhook
```

- [ ] **Commit**

```bash
git add supabase/functions/resend-webhook/
git commit -m "feat: resend-webhook edge function with pipeline auto-update"
```

---

## Task B6: TypeScript Campaign Interfaces

**Files:**
- Create: `src/types/campaigns.ts`

- [ ] **Create the types file**

Create `src/types/campaigns.ts`:

```typescript
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
  // Joined relations (optional — only present when selected)
  email_templates?: { name: string; subject: string } | null
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  prospect_id: number   // bigint in DB → number in TS
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

export interface RichTemplateDB {
  id: string
  name: string
  category: string
  subject: string
  body: string
  variables: string[]
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string | null
}
```

- [ ] **Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Commit**

```bash
git add src/types/campaigns.ts
git commit -m "feat: TypeScript types for campaign entities"
```

---

## Task B7: Campaign Service Layer

**Files:**
- Create: `src/services/campaignService.ts`

- [ ] **Create the service**

Create `src/services/campaignService.ts`:

```typescript
import { supabase } from '@/lib/supabase'
import type { Campaign, CampaignRecipient } from '@/types/campaigns'

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
  updates: Partial<Omit<Campaign, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update(updates)
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

export async function addRecipients(
  campaignId: string,
  prospectIds: number[]
): Promise<void> {
  const rows = prospectIds.map(pid => ({
    campaign_id:  campaignId,
    prospect_id:  pid,
    status:       'pending',
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
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/services/campaignService.ts
git commit -m "feat: campaign service layer"
```

---

## Task B8: Template Service

**Files:**
- Create: `src/services/templateService.ts`

**Critical:** Use `created_by` (not `user_id`) — `email_templates` has no `user_id` column.

- [ ] **Create the service**

Create `src/services/templateService.ts`:

```typescript
import { supabase } from '@/lib/supabase'
import type { RichTemplateDB } from '@/types/campaigns'

export async function getTemplates(createdBy: string): Promise<RichTemplateDB[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('created_by', createdBy)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as RichTemplateDB[]
}

export async function createTemplate(data: {
  name: string
  category: string
  subject: string
  body: string
  variables: string[]
  created_by: string
}): Promise<RichTemplateDB> {
  const { data: result, error } = await supabase
    .from('email_templates')
    .insert({ ...data, is_active: true })
    .select()
    .single()
  if (error) throw error
  return result as RichTemplateDB
}

export async function updateTemplate(
  id: string,
  updates: Partial<Pick<RichTemplateDB, 'name' | 'category' | 'subject' | 'body' | 'variables'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function duplicateTemplate(
  id: string,
  createdBy: string
): Promise<RichTemplateDB> {
  const { data: tpl, error: fetchError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError || !tpl) throw fetchError ?? new Error('Template not found')

  const { id: _id, created_at, updated_at, ...rest } = tpl as RichTemplateDB & { created_at: string; updated_at: string }

  const { data: result, error } = await supabase
    .from('email_templates')
    .insert({ ...rest, name: `${tpl.name} (Copy)`, created_by: createdBy, is_active: true })
    .select()
    .single()
  if (error) throw error
  return result as RichTemplateDB
}
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/services/templateService.ts
git commit -m "feat: template service using created_by FK"
```

---

## Task B9: Outreach Settings Service

**Files:**
- Create: `src/services/outreachSettingsService.ts`

- [ ] **Create the service**

Create `src/services/outreachSettingsService.ts`:

```typescript
import { supabase } from '@/lib/supabase'
import type { OutreachSettings } from '@/types/campaigns'

export async function saveOutreachSettings(
  userId: string,
  settings: OutreachSettings
): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .upsert({
      user_id:        userId,
      provider:       'resend',
      label:          'Resend Email Outreach',
      config:         settings,
      status:         'active',
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })
  if (error) throw error
}

export async function getOutreachSettings(
  userId: string
): Promise<OutreachSettings | null> {
  const { data, error } = await supabase
    .from('integrations')
    .select('config')
    .eq('user_id', userId)
    .eq('provider', 'resend')
    .single()
  if (error) return null
  return (data?.config ?? null) as OutreachSettings | null
}

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
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/services/outreachSettingsService.ts
git commit -m "feat: outreach settings service — integrations + system_settings"
```

---

## Task B10: React Hooks

**Files:**
- Create: `src/hooks/useCampaigns.ts`
- Create: `src/hooks/useTemplates.ts`
- Create: `src/hooks/useOutreachSettings.ts`

- [ ] **Create `useCampaigns`**

Create `src/hooks/useCampaigns.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  launchCampaign, pauseCampaign, addRecipients, getRecipients,
} from '@/services/campaignService'
import type { Campaign, CampaignRecipient } from '@/types/campaigns'

export function useCampaigns(userId: string | null) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      setCampaigns(await getCampaigns(userId))
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return {
    campaigns,
    loading,
    error,
    refresh: fetch,
    create:  async (data: Parameters<typeof createCampaign>[0]) => {
      const c = await createCampaign(data)
      await fetch()
      return c
    },
    update:  async (id: string, data: Parameters<typeof updateCampaign>[1]) => {
      await updateCampaign(id, data)
      await fetch()
    },
    remove:  async (id: string) => {
      await deleteCampaign(id)
      await fetch()
    },
    launch:  async (id: string) => {
      await launchCampaign(id)
      await fetch()
    },
    pause:   async (id: string) => {
      await pauseCampaign(id)
      await fetch()
    },
    addRecipients: async (campaignId: string, prospectIds: number[]) => {
      await addRecipients(campaignId, prospectIds)
      await fetch()
    },
    getRecipients: (campaignId: string): Promise<CampaignRecipient[]> =>
      getRecipients(campaignId),
  }
}
```

- [ ] **Create `useTemplates`**

Create `src/hooks/useTemplates.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  getTemplates, createTemplate, updateTemplate,
  softDeleteTemplate, duplicateTemplate,
} from '@/services/templateService'
import type { RichTemplateDB } from '@/types/campaigns'

export function useTemplates(createdBy: string | null) {
  const [templates, setTemplates] = useState<RichTemplateDB[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!createdBy) return
    setLoading(true)
    try {
      setTemplates(await getTemplates(createdBy))
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [createdBy])

  useEffect(() => { fetch() }, [fetch])

  return {
    templates,
    loading,
    error,
    refresh:    fetch,
    create:     async (data: Parameters<typeof createTemplate>[0]) => {
      const t = await createTemplate(data)
      await fetch()
      return t
    },
    update:     async (id: string, data: Parameters<typeof updateTemplate>[1]) => {
      await updateTemplate(id, data)
      await fetch()
    },
    remove:     async (id: string) => {
      await softDeleteTemplate(id)
      await fetch()
    },
    duplicate:  async (id: string, createdByUser: string) => {
      const t = await duplicateTemplate(id, createdByUser)
      await fetch()
      return t
    },
  }
}
```

- [ ] **Create `useOutreachSettings`**

Create `src/hooks/useOutreachSettings.ts`:

```typescript
import { useState, useEffect } from 'react'
import { getOutreachSettings, saveOutreachSettings } from '@/services/outreachSettingsService'
import type { OutreachSettings } from '@/types/campaigns'

const DEFAULTS: OutreachSettings = {
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

export function useOutreachSettings(userId: string | null) {
  const [settings, setSettings] = useState<OutreachSettings>(DEFAULTS)
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getOutreachSettings(userId)
      .then(s => { if (s) setSettings(s) })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [userId])

  async function save(updates: OutreachSettings): Promise<void> {
    if (!userId) return
    setSaving(true)
    try {
      await saveOutreachSettings(userId, updates)
      setSettings(updates)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
      throw e
    } finally {
      setSaving(false)
    }
  }

  return { settings, loading, saving, error, save }
}
```

- [ ] **Verify build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/hooks/useCampaigns.ts src/hooks/useTemplates.ts src/hooks/useOutreachSettings.ts
git commit -m "feat: useCampaigns, useTemplates, useOutreachSettings hooks"
```

---

## Task B11: Wire EmailsPage to Live Data

**Files:**
- Modify: `src/pages/EmailsPage.tsx`

**Goal:** Replace all `MOCK_CAMPAIGNS` and `MOCK_RICH_TEMPLATES` imports with live hooks. The component structure (views, wizard, detail) stays the same — only the data source changes.

- [ ] **Read the current EmailsPage to map all mock usages**

Open `src/pages/EmailsPage.tsx` and identify:
1. Where `MOCK_CAMPAIGNS` is imported and used as state
2. Where `MOCK_RICH_TEMPLATES` is imported and used as state
3. How `onCreate`, `onEdit`, `onDelete`, `onTogglePause` are implemented as local state mutations

- [ ] **Replace mock campaign state with `useCampaigns`**

At the top of `EmailsPage.tsx`, add these imports:

```typescript
import { useCampaigns } from '@/hooks/useCampaigns'
import { useTemplates  } from '@/hooks/useTemplates'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { toast } from 'sonner'
import type { Campaign } from '@/types/campaigns'
```

Remove the import lines for `MOCK_CAMPAIGNS` and `MOCK_RICH_TEMPLATES`.

Inside the component body, replace mock state with hooks:

```typescript
const { crmUser } = useCurrentUser()
const {
  campaigns, loading: campaignsLoading,
  create: createCampaign, update: updateCampaign,
  remove: deleteCampaign, launch: launchCampaign, pause: pauseCampaign,
} = useCampaigns(crmUser?.id ?? null)

const {
  templates, loading: templatesLoading,
  create: createTemplate, update: updateTemplate,
  remove: deleteTemplate, duplicate: duplicateTemplate,
} = useTemplates(crmUser?.id ?? null)
```

> `useCurrentUser` already exists at `src/hooks/useCurrentUser.ts` — it returns `{ crmUser }` where `crmUser.id` is the `crm_users.id` UUID needed for both hooks.

- [ ] **Replace all mock handler functions with hook calls**

Find and replace each handler:

```typescript
// BEFORE (mock)
function handleCreateCampaign(data: Omit<MockCampaign, 'id'>) {
  const newC = { ...data, id: String(Date.now()) }
  setCampaigns(prev => [...prev, newC])
}

// AFTER (live)
async function handleCreateCampaign(data: ...) {
  try {
    await createCampaign({
      user_id:       crmUser!.id,
      name:          data.name,
      description:   data.description ?? null,
      template_id:   data.template_id ?? null,
      daily_limit:   data.daily_limit,
      send_from_hour: 9,
      send_to_hour:   17,
      send_days:      ['Mon','Tue','Wed','Thu','Fri'],
      warmup_enabled: false,
    })
    toast.success('Campaign created')
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Failed to create campaign')
  }
}
```

Apply the same pattern for `handleDelete`, `handleTogglePause`, `handleLaunch`, template handlers.

> For the template handlers, the `RichTemplate` interface from `mockEmails.ts` differs from `RichTemplateDB`. You'll need to map them in the UI. `RichTemplate` has `updatedAt: string`; `RichTemplateDB` has `updated_at: string | null`. Update the local `RichTemplate` type usage or adapt `TemplateManager` to accept `RichTemplateDB[]`.

- [ ] **Run build and fix all type errors**

```bash
npm run build
npx tsc --noEmit
```

All type errors must be zero before this task is done.

- [ ] **Manual browser test**

```bash
npm run dev
```

1. Navigate to `/emails` → Campaigns tab → should load real campaigns from Supabase (empty initially)
2. Click `+ New Campaign` → complete wizard → campaign appears in list
3. Navigate to Templates tab → should load real templates from Supabase (empty initially)
4. Create a template → it appears in list → edit → delete

- [ ] **Commit**

```bash
git add src/pages/EmailsPage.tsx
git commit -m "feat: wire EmailsPage to live Supabase data via campaign and template hooks"
```

---

## Task B12: Wire EmailOutreachTab to Live Settings

**Files:**
- Modify: `src/components/settings/EmailOutreachTab.tsx`

- [ ] **Replace local state with `useOutreachSettings`**

Open `src/components/settings/EmailOutreachTab.tsx`. Currently it uses standalone `useState` for every field and `toast.success('Outreach settings saved')` without actually saving.

Add imports:

```typescript
import { useOutreachSettings } from '@/hooks/useOutreachSettings'
import { useCurrentUser } from '@/hooks/useCurrentUser'
```

Replace the standalone state declarations with:

```typescript
const { crmUser } = useCurrentUser()
const { settings, loading, saving, save } = useOutreachSettings(crmUser?.id ?? null)

// Derive local form state from settings (controlled form pattern)
const [senderName,  setSenderName]  = useState(settings.sender_name)
const [senderEmail, setSenderEmail] = useState(settings.sender_email)
const [dailyLimit,  setDailyLimit]  = useState(settings.daily_limit)
const [fromHour,    setFromHour]    = useState(settings.send_from_hour)
const [toHour,      setToHour]      = useState(settings.send_to_hour)
const [sendDays,    setSendDays]    = useState(settings.send_days)
const [warmup,      setWarmup]      = useState(settings.warmup_enabled)
const [unsubFooter, setUnsubFooter] = useState(settings.unsubscribe_footer)
const [unsubText,   setUnsubText]   = useState(settings.unsubscribe_text)
```

Add a `useEffect` to sync form when settings load:

```typescript
useEffect(() => {
  setSenderName(settings.sender_name)
  setSenderEmail(settings.sender_email)
  setDailyLimit(settings.daily_limit)
  setFromHour(settings.send_from_hour)
  setToHour(settings.send_to_hour)
  setSendDays(settings.send_days)
  setWarmup(settings.warmup_enabled)
  setUnsubFooter(settings.unsubscribe_footer)
  setUnsubText(settings.unsubscribe_text)
}, [settings])
```

Update `handleSave`:

```typescript
async function handleSave() {
  if (fromHour >= toHour) {
    toast.error('Send window start time must be before end time.')
    return
  }
  try {
    await save({
      sender_name:        senderName,
      sender_email:       senderEmail,
      daily_limit:        dailyLimit,
      send_from_hour:     fromHour,
      send_to_hour:       toHour,
      send_days:          sendDays,
      warmup_enabled:     warmup,
      unsubscribe_footer: unsubFooter,
      unsubscribe_text:   unsubText,
    })
    toast.success('Outreach settings saved')
  } catch {
    toast.error('Failed to save settings')
  }
}
```

Update the Save button to disable while saving:

```tsx
<button
  type="button"
  onClick={handleSave}
  disabled={saving}
  className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
>
  {saving ? 'Saving…' : 'Save Settings'}
</button>
```

- [ ] **Run build**

```bash
npm run build
```

- [ ] **Manual browser test**

```bash
npm run dev
```
1. Go to `/settings` → Email Outreach tab
2. Change Daily Limit to 75 → Save Settings → toast appears
3. Refresh the page → Daily Limit should still be 75 (loaded from Supabase)

- [ ] **Commit**

```bash
git add src/components/settings/EmailOutreachTab.tsx
git commit -m "feat: wire EmailOutreachTab to useOutreachSettings for persistent settings"
```

---

## Task B13: Scheduled Sender (pg_cron)

**Files:** None — SQL only, run in Supabase Dashboard.

- [ ] **Enable pg_cron extension**

Supabase Dashboard → Database → Extensions → search `pg_cron` → Enable.

- [ ] **Schedule hourly batch job**

In Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'send-campaign-batch-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
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

- [ ] **Verify schedule was created**

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'send-campaign-batch-hourly';
```
Expected: 1 row with schedule `0 * * * *`.

- [ ] **No commit needed** (no code files changed)

---

## Execution Order

Execute tasks in this exact order. Each task depends on the previous.

| Order | Task | Prerequisite |
|-------|------|-------------|
| 1 | F7 — Email Compose Upgrade | None (pure frontend) |
| 2 | B1 — Schema Migrations | F7 complete |
| 3 | B2 — RLS Policies | B1 complete |
| 4 | B3 — Resend Setup | B1 complete (can run in parallel with B2) |
| 5 | B4 — Edge Function: Send Batch | B1 + B3 complete |
| 6 | B5 — Edge Function: Webhook | B4 complete |
| 7 | B6 — TypeScript Interfaces | Any (pure types, no deps) |
| 8 | B7 — Campaign Service | B1 + B6 complete |
| 9 | B8 — Template Service | B1 + B6 complete |
| 10 | B9 — Outreach Settings Service | B1 + B6 complete |
| 11 | B10 — React Hooks | B7 + B8 + B9 complete |
| 12 | B11 — Wire EmailsPage | B10 complete |
| 13 | B12 — Wire EmailOutreachTab | B10 complete |
| 14 | B13 — pg_cron Schedule | B4 deployed |

---

## Self-Review Checklist

- [x] Phase F7 covers: template picker, prospect linker, variable preview (with orange unresolved vars), schedule send toggle — all 4 spec requirements
- [x] B1 skips `user_id` column on `email_templates` (plan has explicit note)
- [x] `campaign_recipients.prospect_id` typed as `BIGINT` (matches `prospects.id`)
- [x] All services use `created_by` (not `user_id`) for template queries
- [x] Migration 007 adds `UNIQUE(user_id, provider)` before B12 upsert
- [x] Both Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- [x] `autoPipelineUpdate` never downgrades a deal stage
- [x] `useCurrentUser` exists — no new hook needed for user identity
- [x] `npm run build` + `npx tsc --noEmit` required after every code task
