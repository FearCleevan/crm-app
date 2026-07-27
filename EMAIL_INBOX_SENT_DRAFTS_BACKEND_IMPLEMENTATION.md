# Backend Implementation — Email Inbox / Sent / Drafts

<!-- Phase-by-phase. Execute one phase at a time. Stop after each phase, report, and wait for "Yes, Proceed". -->

## Problem

`EmailsPage.tsx` only exposes Compose, Campaigns, and Templates. Two already-built frontend components (`EmailList.tsx`, `EmailDetail.tsx`) sit unused, fed only by mock data (`mockEmails.ts`). Real backend support is missing for all three folders, and one of them (Inbox) is missing more than code — there's no inbound-email capability in this project at all.

## Current state, confirmed by reading the code

- **Sent:** every real send already leaves a trace — one-off sends via `send_outreach_email` write to `activities` (`type: 'email'`); campaign sends write to `campaign_recipients` + `email_events`. No new send-side infra needed, just a read-side query that unions both.
- **Drafts:** `EmailsPage.tsx` passes `onSaveDraft={() => {}}` to `ComposeModal` — the Save Draft button currently does **nothing** except show a success toast. No `drafts` table exists anywhere in the migrations.
- **Inbox:** Resend (the only email provider wired up) is send-only here. `resend-webhook/index.ts`'s `EVENT_MAP` only covers `email.opened` / `email.clicked` / `email.bounced` / `email.complained` — there is no event, table, or function anywhere that represents a prospect's incoming reply. `'replied'` exists in `STATUS_PRIORITY` and `STAGE_MAP` as dead code with nothing that ever sets it.

## Phase 0 — Decision required before Phase 3 (blocking)

"Inbox" needs one of these three approaches. This is a product/infrastructure decision, not something to default silently:

**Option A — True inbound email.** Set up a real inbound route: a dedicated receiving address/domain, an inbound-parse-capable provider (Resend does not do this; would need e.g. a Cloudflare Email Routing + Worker, Postmark inbound, SendGrid Inbound Parse, or similar), which POSTs parsed incoming mail to a new Edge Function → stored in a new `received_emails` table, matched back to a prospect by sender email. Real infrastructure setup outside just writing code — DNS, a new provider or routing rule, ongoing cost/complexity.

**Option B — Repurpose "Inbox" as an engagement feed.** Don't claim to show replies at all. Show real data that already exists — opens, clicks, bounces — as an "Activity" or "Engagement" view instead of a literal Inbox. Zero new infrastructure, but it's not what "Inbox" implies to a user, so the label needs to change too.

**Option C — Manual reply logging (stopgap).** Add a simple "Log a reply" action on a prospect (paste in what they wrote, or just mark "Replied") that writes a `replied` event by hand. Low engineering effort, no inbound infra, but a manual step every time — doesn't scale, but unblocks the dead `'replied'` status path immediately.

These aren't mutually exclusive — B or C can ship now while A is decided/built later. Recommend confirming this before Phase 3 starts; Phases 1 and 2 (Sent, Drafts) don't depend on this decision at all and can proceed regardless.

## Phase 1 — Sent tab data — DONE, simpler than originally scoped

**Correction while implementing:** all three real send paths — `send_outreach_email` (crm-mcp), `send-campaign-batch`, and `send-scheduled-emails` — already write to the same `activities` table (`type = 'email'`) on success. No union with `campaign_recipients` was actually needed; that table only tracks per-recipient campaign status/timestamps, not a duplicate "sent log" — `activities` already is the unified sent log.

**What was actually missing:** none of the three insert call sites persisted the real recipient address or the sent HTML body — only a human-readable `description` string. Fixed:

- New migration `021_activities_email_body.sql` — adds `email_to TEXT` and `email_body TEXT` to `activities`. **Needs to be run manually in the Supabase Dashboard SQL Editor** (no CLI in this project).
- Added `email_to`/`email_body` to the `activities` insert in all three places: `crm-mcp/tools/outreach.ts` (+ its `DEPLOY_BUNDLE.ts` copy), `send-campaign-batch/index.ts`, `send-scheduled-emails/index.ts`. **All three Edge Functions need redeploying** via the Supabase Dashboard for this to take effect on real sends.
- `src/services/sentEmails.service.ts` — single query against `activities` where `type = 'email'`, normalized into the existing `EmailMessage` shape.
- Known limitation: any `activities` row inserted *before* this migration/redeploy (e.g. the earlier Ontario test send) has no `email_to`/`email_body` — the service falls back to showing the old `description` text instead of a real body. Expected, not a bug — only affects historical rows.

## Phase 2 — Drafts (real persistence)

**Goal:** Make "Save Draft" actually save something, and let a saved draft be resumed or deleted.

- New migration `021_email_drafts.sql`:
  ```sql
  create table email_drafts (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references auth.users(id),
    to_emails   text[] not null default '{}',
    cc_emails   text[] not null default '{}',
    bcc_emails  text[] not null default '{}',
    subject     text,
    body        text,
    template_id uuid references rich_templates(id) on delete set null,
    prospect_id bigint references prospects(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  );
  alter table email_drafts enable row level security;
  create policy "own drafts" on email_drafts for all using (user_id = auth.uid());
  ```
- New `src/services/drafts.service.ts`: `createDraft`, `updateDraft`, `listDrafts`, `deleteDraft`
- Wire `EmailsPage.tsx`'s real `onSaveDraft` (replacing the current `() => {}`) to actually call `createDraft`/`updateDraft` with the Compose modal's current `to`/`cc`/`bcc`/`subject`/`body`/`selectedTemplate`/`linkedProspect` state
- Verify: save a draft, refresh the page, confirm it's still there; delete it, confirm it's gone

## Phase 3 — Inbox (depends on Phase 0 decision)

Scope written once Phase 0 is confirmed — will differ substantially between Option A (new provider integration + `received_emails` table + matching logic) vs. Option B (read-only view over existing `email_events`) vs. Option C (one new "log reply" mutation on top of existing `activities`).

## Phase 4 — Wire the dead 'replied' path

Once Phase 3 lands (any option), extend `resend-webhook` (Option A) or add the equivalent write path (Option C) so `STATUS_PRIORITY`'s `'replied'` state and `STAGE_MAP`'s auto-deal-creation-on-reply logic (already written in `autoPipelineUpdate`, currently unreachable) actually fire. This makes "Avg Reply Rate" on the Campaigns dashboard a real, non-zero-capable number for the first time.

## Verification, every phase

- `npx tsc -b` clean
- Manual check against real data (not assumptions) before calling a phase done
- Stop and report after each phase; wait for "Yes, Proceed" before the next
