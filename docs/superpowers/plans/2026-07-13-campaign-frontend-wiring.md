# Campaign Frontend Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Phase-gate protocol (per user's global CLAUDE.md):** Each Task below is one phase. Stop after each Task, report status with build output, and await explicit "Yes, Proceed" before starting the next Task.

**Goal:** Close the 5 confirmed gaps where the email-campaign feature's frontend has real, already-built backend services sitting unused behind mock/dead UI code.

**Architecture:** No new backend plumbing needed for Tasks 1, 2, 3, 5. Task 4 adds two denormalized columns to `deals` (matching the existing pattern of denormalizing `prospect_name`/`company` onto deals) so the dead `CampaignBadge` check becomes real. Task 5 adds one new table (`scheduled_emails`) since no persistence mechanism for scheduled sends exists anywhere in the current schema.

**Tech Stack:** React 19 + TypeScript, Vite, Supabase JS 2.105, Recharts, Tailwind CSS v3, no test framework configured (verification is `tsc -b`, `eslint`, and manual browser check per project convention).

## Global Constraints

- Tailwind CSS v3 classes only (project uses v3, not v4) — match existing class patterns in each file, don't introduce new design tokens.
- Both light and dark mode must keep working — reuse existing `dark:` classes already present in each file; don't strip them.
- `prospects.id` is `bigint` in Postgres → always `number` in TypeScript; the `Prospect` type in `src/constants/mockData.ts` stores it as `string` at the UI layer (existing app convention) — cast with `Number(prospect.id)` when calling a service that expects the DB bigint, matching the existing pattern in `supabase/functions/resend-webhook/index.ts:110` (`Number(recipient.prospect_id)`).
- Definition of Done for every task: `cd crm-app && npx tsc -b` and `npx eslint .` must both pass with zero errors before the task is reported complete. Do not mark a task done on unbuilt/untype-checked code.
- Supabase Edge Functions in this project are deployed via the Supabase Dashboard, not CLI — do not add CLI deploy instructions; migrations are run manually via Supabase SQL Editor (existing convention, see header comments in `supabase/migrations/009_deals_schema.sql`).
- Migration files for this feature live in `crm-app/supabase/migrations/` (the diverged, campaign-specific migration set — NOT the root `supabase/migrations/`), numbered next in that sequence (currently ends at `007_integrations_unique.sql`).

---

## Task 1: Wire CampaignDetailView to real recipient/activity data

**Files:**
- Modify: `crm-app/src/components/emails/CampaignDetailView.tsx` (currently lines 1-135, full file)
- Modify: `crm-app/src/pages/EmailsPage.tsx:29-36` (destructure `getRecipients` from `useCampaigns`), and the render call at `EmailsPage.tsx:272`

**Interfaces:**
- Consumes: `campaignService.getRecipients(campaignId: string): Promise<CampaignRecipient[]>` (already exists, exposed via `useCampaigns(userId).getRecipients`, `src/hooks/useCampaigns.ts:58-59`). `CampaignRecipient` type from `src/types/campaigns.ts:29-49` — has `prospects` joined object with `fullname, email, company, country`, plus `status` and `sent_at/opened_at/clicked_at/replied_at/bounced_at/unsubscribed_at`.
- Produces: no new exports; `CampaignDetailView` gets one new required prop `getRecipients: (campaignId: string) => Promise<CampaignRecipient[]>`.

- [ ] **Step 1: Pass `getRecipients` down from EmailsPage**

In `crm-app/src/pages/EmailsPage.tsx`, the `useCampaigns` destructure currently reads (lines 29-36):

```typescript
  const {
    campaigns,
    create: createCampaign,
    update: updateCampaign,
    remove: removeCampaign,
    launch: launchCampaign,
    pause: pauseCampaign,
  } = useCampaigns(userId)
```

Change to:

```typescript
  const {
    campaigns,
    create: createCampaign,
    update: updateCampaign,
    remove: removeCampaign,
    launch: launchCampaign,
    pause: pauseCampaign,
    getRecipients,
  } = useCampaigns(userId)
```

Then at line 272, change:

```typescript
                <CampaignDetailView campaign={c} onBack={() => setViewingCampaignId(null)} />
```

to:

```typescript
                <CampaignDetailView campaign={c} onBack={() => setViewingCampaignId(null)} getRecipients={getRecipients} />
```

- [ ] **Step 2: Rewrite CampaignDetailView.tsx to fetch and derive real data**

Replace the full contents of `crm-app/src/components/emails/CampaignDetailView.tsx` with:

```typescript
// src/components/emails/CampaignDetailView.tsx
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatDate, formatTime, getStatusBadgeClass } from '@/lib/campaign-utils'
import type { Campaign, CampaignRecipient } from '@/types/campaigns'
import { cn } from '@/lib/utils'

const STAT_CARDS = (c: Campaign) => [
  { label: 'Recipients', value: c.total_recipients },
  { label: 'Sent',       value: c.total_sent       },
  { label: 'Pending',    value: c.total_recipients - c.total_sent },
  { label: 'Opened',     value: c.total_opened,  pct: c.total_sent ? `${Math.round(c.total_opened/c.total_sent*100)}%` : '—' },
  { label: 'Clicked',    value: c.total_clicked,       pct: c.total_sent ? `${Math.round(c.total_clicked/c.total_sent*100)}%` : '—' },
  { label: 'Replied',    value: c.total_replied,       pct: c.total_sent ? `${Math.round(c.total_replied/c.total_sent*100)}%` : '—' },
  { label: 'Bounced',    value: c.total_bounced,       pct: c.total_sent ? `${Math.round(c.total_bounced/c.total_sent*100)}%` : '—' },
  { label: 'Unsub',      value: c.total_unsubscribed,  pct: c.total_sent ? `${Math.round(c.total_unsubscribed/c.total_sent*100)}%` : '—' },
]

type TabFilter = 'all' | 'sent' | 'opened' | 'replied' | 'bounced'

interface DailyActivity { date: string; sent: number; opened: number }

// Derive a per-day sent/opened series from recipient timestamps (no separate
// email_events query needed — campaign_recipients already carries sent_at/opened_at).
function buildDailyActivity(recipients: CampaignRecipient[]): DailyActivity[] {
  const byDate = new Map<string, DailyActivity>()
  function bump(ts: string | null, field: 'sent' | 'opened') {
    if (!ts) return
    const day = ts.slice(0, 10) // YYYY-MM-DD
    const row = byDate.get(day) ?? { date: day, sent: 0, opened: 0 }
    row[field] += 1
    byDate.set(day, row)
  }
  for (const r of recipients) {
    bump(r.sent_at, 'sent')
    bump(r.opened_at, 'opened')
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function lastActivityOf(r: CampaignRecipient): string {
  return r.replied_at ?? r.clicked_at ?? r.opened_at ?? r.bounced_at ?? r.unsubscribed_at ?? r.sent_at ?? r.created_at
}

interface Props {
  campaign: Campaign
  onBack: () => void
  getRecipients: (campaignId: string) => Promise<CampaignRecipient[]>
}

export function CampaignDetailView({ campaign, onBack, getRecipients }: Props) {
  const [tab, setTab] = useState<TabFilter>('all')
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getRecipients(campaign.id)
      .then(rows => { if (!cancelled) setRecipients(rows) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [campaign.id, getRecipients])

  const dailyActivity = useMemo(() => buildDailyActivity(recipients), [recipients])
  const filtered = tab === 'all' ? recipients : recipients.filter(r => r.status === tab)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <button type="button" onClick={onBack} aria-label="Back to campaigns"
          className="flex items-center gap-1.5 h-7 px-2 rounded-lg hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
        </button>
        <div className="h-4 w-px bg-border" />
        <h2 className="text-sm font-bold text-foreground">{campaign.name}</h2>
        <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold capitalize', getStatusBadgeClass(campaign.status))}>
          {campaign.status}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 px-5 py-4 border-b border-border shrink-0">
        {STAT_CARDS(campaign).map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-3 py-2 text-center">
            <p className="text-base font-bold text-foreground">{s.value}</p>
            {s.pct && <p className="text-[9px] text-muted-foreground">{s.pct}</p>}
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-xs font-semibold text-foreground mb-3">Daily Activity</p>
        {dailyActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">
            {loading ? 'Loading…' : 'No email activity yet'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => formatDate(d).replace(/,.*/, '')} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip labelFormatter={l => formatDate(l)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="sent"   stroke="#3b82f6" strokeWidth={2} dot={false} name="Sent"   />
              <Line type="monotone" dataKey="opened" stroke="#22c55e" strokeWidth={2} dot={false} name="Opened" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recipient table */}
      <div className="flex-1 px-5 pb-5">
        <div className="flex gap-1 mt-4 mb-3 border-b border-border">
          {(['all','sent','opened','replied','bounced'] as TabFilter[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`h-8 px-3 text-xs font-medium border-b-2 capitalize transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Loading recipients…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No recipients in this view</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Full Name','Company','Email','Country','Status','Last Activity'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-foreground whitespace-nowrap">{r.prospects?.fullname ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.prospects?.company ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">{r.prospects?.email ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.prospects?.country ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold capitalize', getStatusBadgeClass(r.status))}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                    {formatDate(lastActivityOf(r))} {formatTime(lastActivityOf(r))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd crm-app && npx tsc -b`
Expected: no errors (verify `CampaignRecipient` import path and prop shape match `src/types/campaigns.ts` exactly).

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open Emails → Campaigns, click into any campaign with at least one recipient. Confirm the stat cards still render (unchanged), the chart shows either real data points or the "No email activity yet" empty state (not the old flat mock line), and the recipient table shows actual prospect names/emails from the database, not "Sarah Mitchell" / "James Ortega" etc.

- [ ] **Step 5: Commit**

```bash
git add crm-app/src/components/emails/CampaignDetailView.tsx crm-app/src/pages/EmailsPage.tsx
git commit -m "fix: wire CampaignDetailView to real recipient/activity data"
```

---

## Task 2: Wire CampaignActivityFeed to real prospect email events

**Files:**
- Modify: `crm-app/src/services/campaignService.ts` (add one function)
- Modify: `crm-app/src/components/prospects/CampaignActivityFeed.tsx` (drop the mock default)
- Modify: `crm-app/src/components/prospects/ProspectDetailSheet.tsx:1-16` (imports), `:102-111` (add state), and the render call currently at `:348` (`<CampaignActivityFeed />`)

**Interfaces:**
- Consumes: `EmailEvent` type (`src/types/campaigns.ts:52-59`) — has `campaign_id, prospect_id, event_type, occurred_at`. `email_events` table joins to `email_campaigns(name)`.
- Produces: new exported function `getProspectCampaignEvents(prospectId: number): Promise<CampaignEvent[]>` in `campaignService.ts`, where `CampaignEvent` is the existing interface from `CampaignActivityFeed.tsx` (`{ id: string; type: 'sent'|'opened'|'clicked'|'replied'; occurredAt: string; campaignName: string }`).

- [ ] **Step 1: Add getProspectCampaignEvents to campaignService.ts**

Append to `crm-app/src/services/campaignService.ts`:

```typescript
export interface ProspectCampaignEvent {
  id: string
  type: 'sent' | 'opened' | 'clicked' | 'replied'
  occurredAt: string
  campaignName: string
}

export async function getProspectCampaignEvents(prospectId: number): Promise<ProspectCampaignEvent[]> {
  const { data, error } = await supabase
    .from('email_events')
    .select('id, event_type, occurred_at, email_campaigns(name)')
    .eq('prospect_id', prospectId)
    .in('event_type', ['sent', 'opened', 'clicked', 'replied'])
    .order('occurred_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    type: row.event_type as ProspectCampaignEvent['type'],
    occurredAt: row.occurred_at,
    campaignName: (row.email_campaigns as unknown as { name: string } | null)?.name ?? 'Campaign',
  }))
}
```

- [ ] **Step 2: Drop the mock default in CampaignActivityFeed.tsx**

In `crm-app/src/components/prospects/CampaignActivityFeed.tsx`, replace the whole file with:

```typescript
import { formatDate, formatTime } from '@/lib/campaign-utils'

export interface CampaignEvent {
  id: string
  type: 'sent' | 'opened' | 'clicked' | 'replied'
  occurredAt: string
  campaignName: string
}

const EVENT_ICON: Record<CampaignEvent['type'], string> = {
  sent:    '📤',
  opened:  '👁️',
  clicked: '🔗',
  replied: '💬',
}
const EVENT_LABEL: Record<CampaignEvent['type'], string> = {
  sent:    'Email sent via',
  opened:  'Email opened from',
  clicked: 'Link clicked from',
  replied: 'Reply received from',
}

interface Props { events: CampaignEvent[] }

export function CampaignActivityFeed({ events }: Props) {
  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">No campaign activity for this prospect yet.</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">Campaign Activity</p>
      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className="flex items-start gap-3 text-xs">
            <span className="text-base leading-none mt-0.5">{EVENT_ICON[ev.type]}</span>
            <div className="min-w-0">
              <span className="text-muted-foreground">
                {formatDate(ev.occurredAt)} {formatTime(ev.occurredAt)}
              </span>
              <span className="text-foreground ml-1">
                — {EVENT_LABEL[ev.type]} <span className="font-medium">"{ev.campaignName}"</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Note: `events` is now required (no default), so every caller must pass real data — this is intentional, it forces Step 3 below rather than silently falling back to mock data again.

- [ ] **Step 3: Fetch and pass real events in ProspectDetailSheet.tsx**

In `crm-app/src/components/prospects/ProspectDetailSheet.tsx`, add the import (near line 1, alongside the existing `useState` import):

```typescript
import { useState, useEffect } from 'react'
```

Add the service import near line 14 (alongside the existing `CampaignActivityFeed` import):

```typescript
import { getProspectCampaignEvents, type ProspectCampaignEvent } from '@/services/campaignService'
```

Add new state after the existing `noteInput` state (currently line 111):

```typescript
  const [campaignEvents, setCampaignEvents] = useState<ProspectCampaignEvent[]>([])

  useEffect(() => {
    let cancelled = false
    getProspectCampaignEvents(Number(prospect.id))
      .then(events => { if (!cancelled) setCampaignEvents(events) })
      .catch(() => { if (!cancelled) setCampaignEvents([]) })
    return () => { cancelled = true }
  }, [prospect.id])
```

Change the render call (currently around line 348):

```typescript
                  <CampaignActivityFeed />
```

to:

```typescript
                  <CampaignActivityFeed events={campaignEvents} />
```

- [ ] **Step 4: Typecheck and lint**

Run: `cd crm-app && npx tsc -b`
Expected: no errors. If `email_campaigns(name)` join typing on the Supabase query in Step 1 doesn't infer cleanly, the explicit `as unknown as {name:string}|null` cast already handles it — don't add `any`.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open a prospect that has received at least one campaign email (check `campaign_recipients` in Supabase for a `sent`/`opened` row), open its detail sheet on the Overview tab. Confirm the Campaign Activity section shows the real event(s) with the real campaign name, and for a prospect with zero campaign history it shows "No campaign activity for this prospect yet." instead of the old hardcoded 4-event mock feed.

- [ ] **Step 6: Commit**

```bash
git add crm-app/src/services/campaignService.ts crm-app/src/components/prospects/CampaignActivityFeed.tsx crm-app/src/components/prospects/ProspectDetailSheet.tsx
git commit -m "fix: wire CampaignActivityFeed to real email_events data"
```

---

## Task 3: Wire "Last Campaign" prospects table column to real data

**Files:**
- Modify: `crm-app/src/services/campaignService.ts` (add one function)
- Modify: `crm-app/src/components/prospects/ProspectsTable.tsx:100` (`CellContent`) and the `ProspectsTableProps`/component signature
- Modify: `crm-app/src/pages/ProspectsPage.tsx:612` (pass new prop)

**Interfaces:**
- Consumes: `campaign_recipients` joined to `email_campaigns(name)`, filtered by `prospect_id IN (...)`.
- Produces: new exported function `getLatestCampaignActivity(prospectIds: number[]): Promise<Map<number, { campaignName: string; status: string; lastActivity: string }>>` in `campaignService.ts`. New prop `campaignActivity: Map<number, { campaignName: string; status: string; lastActivity: string }>` on `ProspectsTable`, threaded into `CellContent`.

- [ ] **Step 1: Add getLatestCampaignActivity to campaignService.ts**

Append to `crm-app/src/services/campaignService.ts` (after the `getProspectCampaignEvents` added in Task 2):

```typescript
export interface LatestCampaignActivity {
  campaignName: string
  status: string
  lastActivity: string
}

export async function getLatestCampaignActivity(
  prospectIds: number[]
): Promise<Map<number, LatestCampaignActivity>> {
  const result = new Map<number, LatestCampaignActivity>()
  if (prospectIds.length === 0) return result

  const { data, error } = await supabase
    .from('campaign_recipients')
    .select('prospect_id, status, sent_at, opened_at, clicked_at, replied_at, bounced_at, unsubscribed_at, created_at, email_campaigns(name)')
    .in('prospect_id', prospectIds)
    .order('created_at', { ascending: false })
  if (error) throw error

  for (const row of data ?? []) {
    const pid = row.prospect_id as number
    if (result.has(pid)) continue // keep the most recent per prospect (already ordered desc)
    const lastActivity =
      row.replied_at ?? row.clicked_at ?? row.opened_at ?? row.bounced_at ?? row.unsubscribed_at ?? row.sent_at ?? row.created_at
    result.set(pid, {
      campaignName: (row.email_campaigns as unknown as { name: string } | null)?.name ?? 'Campaign',
      status: row.status,
      lastActivity,
    })
  }
  return result
}
```

- [ ] **Step 2: Thread a campaignActivity prop through ProspectsTable**

In `crm-app/src/components/prospects/ProspectsTable.tsx`, change the `CellContent` component signature (currently around line 91):

```typescript
const CellContent = memo(function CellContent({ col, p, compact }: { col: ColDef; p: Prospect; compact: boolean }) {
```

to:

```typescript
const CellContent = memo(function CellContent({
  col, p, compact, campaignActivity,
}: {
  col: ColDef
  p: Prospect
  compact: boolean
  campaignActivity: Map<number, { campaignName: string; status: string; lastActivity: string }>
}) {
```

Change the `lastcampaign` case (currently `case 'lastcampaign':   return <span className="text-xs text-muted-foreground whitespace-nowrap">—</span>`) to:

```typescript
    case 'lastcampaign': {
      const activity = campaignActivity.get(Number(p.id))
      if (!activity) return <span className="text-xs text-muted-foreground whitespace-nowrap">—</span>
      return (
        <span className="text-xs text-muted-foreground whitespace-nowrap truncate block max-w-[140px]" title={`${activity.campaignName} · ${activity.status}`}>
          {activity.campaignName} · <span className="capitalize">{activity.status}</span>
        </span>
      )
    }
```

Add `campaignActivity` to `ProspectsTableProps` (currently around line 138, alongside `isLoading?: boolean`):

```typescript
  isLoading?: boolean
  campaignActivity: Map<number, { campaignName: string; status: string; lastActivity: string }>
```

Add it to the destructured component props (currently around line 152, alongside `isLoading`):

```typescript
  isLoading,
  campaignActivity,
```

Find every place `CellContent` is invoked inside `ProspectsTable.tsx` (there are two render paths — the desktop table and the mobile card view) and pass the new prop through, e.g. `<CellContent col={col} p={p} compact={compact} campaignActivity={campaignActivity} />`.

- [ ] **Step 3: Fetch campaign activity in ProspectsPage.tsx and pass it down**

In `crm-app/src/pages/ProspectsPage.tsx`, add near the top-level imports:

```typescript
import { getLatestCampaignActivity } from '@/services/campaignService'
```

Add state near the other `useState` declarations:

```typescript
  const [campaignActivity, setCampaignActivity] = useState<Map<number, { campaignName: string; status: string; lastActivity: string }>>(new Map())
```

Add a `useEffect` that refetches whenever the currently displayed page of `prospects` changes (mirror the existing `useEffect` pattern already in this file for consistency — place it near the other data-fetching effects):

```typescript
  useEffect(() => {
    const ids = prospects.map(p => Number(p.id)).filter(id => !Number.isNaN(id))
    if (ids.length === 0) { setCampaignActivity(new Map()); return }
    let cancelled = false
    getLatestCampaignActivity(ids)
      .then(map => { if (!cancelled) setCampaignActivity(map) })
      .catch(() => { if (!cancelled) setCampaignActivity(new Map()) })
    return () => { cancelled = true }
  }, [prospects])
```

At the `<ProspectsTable ... />` call (currently line 612-onward), add the prop:

```typescript
            campaignActivity={campaignActivity}
```

- [ ] **Step 4: Typecheck and lint**

Run: `cd crm-app && npx tsc -b`
Expected: no errors. Pay attention to every `CellContent` call site found in Step 2 — TypeScript will fail loudly if any is missed since `campaignActivity` is now a required prop.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open Prospects, ensure the "Last Campaign" column (default-visible per `ALL_COLUMNS` in `ProspectsTable.tsx:45`) shows a real campaign name + status for prospects who are in `campaign_recipients`, and still shows `—` for prospects with no campaign history. Confirm no console errors and that paging still works (activity should refetch per page since the effect depends on `prospects`).

- [ ] **Step 6: Commit**

```bash
git add crm-app/src/services/campaignService.ts crm-app/src/components/prospects/ProspectsTable.tsx crm-app/src/pages/ProspectsPage.tsx
git commit -m "fix: wire Last Campaign prospects column to real campaign_recipients data"
```

---

## Task 4: Make CampaignBadge on deal cards real (denormalized source campaign)

**Files:**
- Create: `crm-app/supabase/migrations/008_deals_campaign_source.sql`
- Modify: `crm-app/supabase/functions/resend-webhook/index.ts` (the `autoPipelineUpdate` function)
- Modify: `crm-app/src/types/database.ts:117-136` (`DealRow`/`DealInsert`)
- Modify: `crm-app/src/components/deals/DealCard.tsx:6, 91` (import + real field check)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `deals.source_campaign_id` (uuid, nullable FK to `email_campaigns.id`) and `deals.source_campaign_name` (text, nullable) columns; `DealRow.source_campaign_name: string | null`.

- [ ] **Step 1: Write the migration**

Create `crm-app/supabase/migrations/008_deals_campaign_source.sql`:

```sql
-- ============================================================
-- Brisk CRM — Deals Campaign Source (Migration 008)
-- Run this in Supabase SQL Editor → New Query → Run
-- IMPORTANT: Run AFTER migrations 001–007 (root) and this
-- crm-app-specific set's 004–007 (campaign tables).
-- ============================================================
-- Denormalizes the originating campaign onto deals table,
-- matching the existing pattern of denormalizing prospect_name
-- and company (see 009_deals_schema.sql in root migrations).
-- Lets DealCard show "Via Campaign" without an extra join.
-- ============================================================

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS source_campaign_id uuid
    REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_campaign_name text;

CREATE INDEX IF NOT EXISTS idx_deals_source_campaign_id
  ON public.deals(source_campaign_id)
  WHERE source_campaign_id IS NOT NULL;
```

- [ ] **Step 2: Run the migration**

Open the Supabase Dashboard → SQL Editor → paste the contents of `crm-app/supabase/migrations/008_deals_campaign_source.sql` → Run. Confirm no errors and that `deals` now has the two new nullable columns (Table Editor → deals → check columns).

- [ ] **Step 3: Set the columns when auto-creating a deal from a reply**

In `crm-app/supabase/functions/resend-webhook/index.ts`, in the `autoPipelineUpdate` function, the `else if (eventType === 'replied')` branch currently does:

```typescript
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
    })
  }
```

The function's `autoPipelineUpdate` signature only receives `(prospectId: number, eventType: string)` — it needs the campaign id and name too, which are available at the call site. Change the function signature to:

```typescript
async function autoPipelineUpdate(prospectId: number, eventType: string, campaignId: string, campaignName: string) {
```

And change the deal insert in the `replied` branch to include the two new columns:

```typescript
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
```

Then update the call site further down in the file, where `autoPipelineUpdate` is currently invoked:

```typescript
  // Trigger pipeline auto-update
  await autoPipelineUpdate(Number(recipient.prospect_id), eventType)
```

to:

```typescript
  // Trigger pipeline auto-update
  await autoPipelineUpdate(Number(recipient.prospect_id), eventType, recipient.campaign_id, campaignName)
```

(`campaignName` is already computed a few lines above this call for the activity-log insert — reuse that existing local variable, don't recompute it.)

- [ ] **Step 4: Redeploy the edge function**

Per this project's convention (Supabase Dashboard only, no CLI): open Supabase Dashboard → Edge Functions → `resend-webhook` → paste the updated `crm-app/supabase/functions/resend-webhook/index.ts` contents → Deploy.

- [ ] **Step 5: Update the DealRow/DealInsert type**

In `crm-app/src/types/database.ts`, the `DealRow` interface currently ends (lines 117-134):

```typescript
export interface DealRow {
  id: string                      // uuid
  name: string
  prospect_id: number | null      // FK → prospects.id (integer)
  prospect_name: string
  company: string
  stage: DealStage
  value: number
  probability: number
  expected_close_date: string     // date as ISO string YYYY-MM-DD
  assigned_to: string | null      // uuid → crm_users.id
  stage_changed_at: string        // timestamptz
  sort_order: number
  description: string | null
  created_by: string | null       // uuid → crm_users.id
  created_at: string              // timestamptz
  updated_at: string              // timestamptz
}
```

Add two fields before the closing brace:

```typescript
  created_at: string              // timestamptz
  updated_at: string              // timestamptz
  source_campaign_id: string | null    // uuid → email_campaigns.id
  source_campaign_name: string | null
}
```

`DealInsert`/`DealUpdate` are derived via `Omit`/`Partial<Omit<...>>` from `DealRow` (lines 136-137), so they automatically pick up the new optional-via-nullable fields — no change needed there.

- [ ] **Step 6: Wire DealCard.tsx to the real field**

In `crm-app/src/components/deals/DealCard.tsx`, the badge line currently reads (around line 91):

```typescript
          {/* Campaign badge */}
          {(deal as any).fromCampaign && <CampaignBadge campaignName={(deal as any).fromCampaign} />}
```

Change to:

```typescript
          {/* Campaign badge */}
          {deal.source_campaign_name && <CampaignBadge campaignName={deal.source_campaign_name} />}
```

This requires `deal: Deal` (the prop type, imported from `@/constants/mockData` at line 6) to carry `source_campaign_name`. Check `CampaignBadge`'s prop type (`crm-app/src/components/deals/CampaignBadge.tsx`) accepts a plain `string`, then add the field to the `Deal` interface in `crm-app/src/constants/mockData.ts` (currently lines 51-65, ending `createdOn: string`):

```typescript
export interface Deal {
  id: string
  name: string
  prospectId: string
  prospectName: string
  company: string
  stage: 'New Lead' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Closed Won' | 'Closed Lost'
  value: number
  probability: number
  expectedCloseDate: string
  assignedTo: string
  daysInStage: number
  description: string
  createdOn: string
  sourceCampaignName: string | null
}
```

Since `DealCard` actually receives real `DealRow` objects at runtime (not the `Deal` mock shape — confirm this by checking how `DealsPage.tsx` maps `dealsService.getDeals()` results before passing to `DealCard`), align the exact field name used in Step 6's JSX (`deal.source_campaign_name`, snake_case matching `DealRow`) with whichever type `DealCard`'s `deal` prop is actually typed as at runtime. If `DealsPage.tsx` passes `DealRow` objects directly (not mapped to the camelCase `Deal` mock type), skip the `mockData.ts` edit above and instead change `DealCardProps` in `DealCard.tsx` to import `DealRow` from `@/types/database` instead of `Deal` from `@/constants/mockData`, matching whatever `DealsPage.tsx` actually passes down. Verify this by reading `DealsPage.tsx`'s prop-passing code before making this edit — do not guess.

- [ ] **Step 7: Typecheck and lint**

Run: `cd crm-app && npx tsc -b`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors. No `as any` should remain on the campaign-badge line.

- [ ] **Step 8: Manual verification**

Trigger a real or simulated `resend-webhook` reply event for a test prospect (or manually insert a `deals` row with `source_campaign_id`/`source_campaign_name` set via SQL Editor for a quick UI check), open the Deals kanban, confirm the "📧 Via Campaign" badge renders on that card and is clickable, and confirm cards without a source campaign show no badge (not a crash).

- [ ] **Step 9: Commit**

```bash
git add crm-app/supabase/migrations/008_deals_campaign_source.sql crm-app/supabase/functions/resend-webhook/index.ts crm-app/src/types/database.ts crm-app/src/components/deals/DealCard.tsx
git commit -m "feat: denormalize source campaign onto deals, wire real CampaignBadge"
```

---

## Task 5: Persist scheduled email sends

**Files:**
- Create: `crm-app/supabase/migrations/009_scheduled_emails.sql`
- Modify: `crm-app/src/services/email.service.ts`
- Modify: `crm-app/src/components/emails/ComposeModal.tsx` (the `handleSend` schedule branch)

**Interfaces:**
- Consumes: `useAuth()` (`crm-app/src/context/AuthContext`) already imported in `ComposeModal.tsx:7` — provides `user.id` for `created_by`.
- Produces: `scheduled_emails` table. New exported function `emailService.scheduleSend(params: SendEmailParams & { scheduledAt: string; userId: string }): Promise<void>` in `email.service.ts`.

- [ ] **Step 1: Write the migration**

Create `crm-app/supabase/migrations/009_scheduled_emails.sql`:

```sql
-- ============================================================
-- Brisk CRM — Scheduled Emails (Migration 009)
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================
-- Persists "Schedule Send" from ComposeModal, which previously
-- only showed a toast with no storage. Actual dispatch at the
-- scheduled time is a follow-up (needs a pg_cron job + edge
-- function, same manual-dashboard pattern as B10 in
-- BRISK_CRM_MASTER_BACKEND.md) — this migration unblocks
-- persistence only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_by    uuid        NOT NULL REFERENCES public.crm_users(id) ON DELETE CASCADE,
  to_addresses  text[]      NOT NULL,
  cc_addresses  text[]      NOT NULL DEFAULT '{}',
  bcc_addresses text[]      NOT NULL DEFAULT '{}',
  subject       text        NOT NULL,
  html          text        NOT NULL,
  scheduled_at  timestamptz NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status = ANY (ARRAY['pending','sent','failed','cancelled'])),
  sent_at       timestamptz,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_emails_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
  ON public.scheduled_emails(scheduled_at)
  WHERE status = 'pending';

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own scheduled emails" ON public.scheduled_emails;
CREATE POLICY "Users manage own scheduled emails"
ON public.scheduled_emails FOR ALL
USING (
  created_by IN (SELECT id FROM public.crm_users WHERE auth_id = auth.uid())
);
```

- [ ] **Step 2: Run the migration**

Open the Supabase Dashboard → SQL Editor → paste the contents of `crm-app/supabase/migrations/009_scheduled_emails.sql` → Run. Confirm the `scheduled_emails` table appears in Table Editor with RLS enabled.

- [ ] **Step 3: Add scheduleSend to email.service.ts**

Replace the full contents of `crm-app/src/services/email.service.ts` with:

```typescript
import { supabase } from '@/lib/supabase'

interface SendEmailParams {
  to:       string | string[]
  cc?:      string | string[]
  bcc?:     string | string[]
  subject:  string
  html:     string
}

interface ScheduleSendParams extends SendEmailParams {
  scheduledAt: string
  userId: string
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

export const emailService = {
  async send(params: SendEmailParams): Promise<void> {
    const { error } = await supabase.functions.invoke('send-email', {
      body: params,
    })
    if (error) throw new Error(error.message ?? 'Failed to send email')
  },

  async scheduleSend(params: ScheduleSendParams): Promise<void> {
    const { error } = await supabase.from('scheduled_emails').insert({
      created_by:    params.userId,
      to_addresses:  toArray(params.to),
      cc_addresses:  toArray(params.cc),
      bcc_addresses: toArray(params.bcc),
      subject:       params.subject,
      html:          params.html,
      scheduled_at:  params.scheduledAt,
      status:        'pending',
    })
    if (error) throw new Error(error.message ?? 'Failed to schedule email')
  },
}
```

- [ ] **Step 4: Call scheduleSend from ComposeModal's handleSend**

In `crm-app/src/components/emails/ComposeModal.tsx`, the `handleSend` function currently has this schedule branch (inside `async function handleSend()`):

```typescript
    // Schedule send
    if (scheduledAt) {
      if (new Date(scheduledAt) <= new Date()) {
        toast.error('Scheduled time must be in the future')
        return
      }
      const formatted = new Date(scheduledAt).toLocaleString()
      toast.success(`Email scheduled for ${formatted}`)
      onClose()
      return
    }
```

Change to:

```typescript
    // Schedule send
    if (scheduledAt) {
      if (new Date(scheduledAt) <= new Date()) {
        toast.error('Scheduled time must be in the future')
        return
      }
      if (!user?.id) {
        toast.error('You must be signed in to schedule an email')
        return
      }
      setSending(true)
      try {
        await emailService.scheduleSend({
          to:      toChips,
          ...(ccChips.length > 0 ? { cc: ccChips } : {}),
          ...(bccChips.length > 0 ? { bcc: bccChips } : {}),
          subject: subject || '(no subject)',
          html:    getFinalHtml(),
          scheduledAt: new Date(scheduledAt).toISOString(),
          userId: user.id,
        })
        const formatted = new Date(scheduledAt).toLocaleString()
        toast.success(`Email scheduled for ${formatted}`)
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to schedule email')
      } finally {
        setSending(false)
      }
      return
    }
```

`user` is already destructured from `useAuth()` at the top of the component (`const { user } = useAuth()`), and `emailService` is already imported (`import { emailService } from '@/services/email.service'`) — no new imports needed.

- [ ] **Step 5: Typecheck and lint**

Run: `cd crm-app && npx tsc -b`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open Compose, fill in a recipient/subject/body, toggle Schedule Send, pick a future datetime, click send. Confirm the toast still shows, and in Supabase Table Editor → `scheduled_emails`, confirm a new `pending` row appeared with the correct `to_addresses`, `subject`, `html`, and `scheduled_at`. Also confirm picking a past datetime still shows the existing "must be in the future" error and does NOT insert a row.

- [ ] **Step 7: Commit**

```bash
git add crm-app/supabase/migrations/009_scheduled_emails.sql crm-app/src/services/email.service.ts crm-app/src/components/emails/ComposeModal.tsx
git commit -m "feat: persist scheduled email sends instead of toast-only"
```

**Follow-up not in scope for this task:** actually dispatching scheduled emails at their `scheduled_at` time needs a new edge function (e.g. `send-scheduled-emails`) plus a pg_cron job, mirroring the existing `send-campaign-batch` + B10 manual-dashboard-cron pattern. Flag this as the next unit of work once this task is confirmed working.

---

## Self-Review Notes

- **Spec coverage:** All 5 gaps from the campaign-feature audit are covered — CampaignDetailView (Task 1), CampaignActivityFeed (Task 2), Last Campaign column (Task 3), CampaignBadge/fromCampaign (Task 4), Schedule Send persistence (Task 5).
- **Placeholder scan:** No TBD/TODO markers. Task 4 Step 6 has an explicit verification instruction ("check DealsPage.tsx before editing") rather than a placeholder, because the exact runtime shape of the `deal` prop (mock `Deal` type vs. real `DealRow`) wasn't confirmed during planning and must not be guessed — this is a deliberate verification gate, not missing content.
- **Type consistency:** `CampaignRecipient`, `Campaign`, `ProspectCampaignEvent`, `LatestCampaignActivity`, and `DealRow` field names are used identically across every task that touches them, matching `src/types/campaigns.ts` and `src/types/database.ts` as read from the current codebase.
