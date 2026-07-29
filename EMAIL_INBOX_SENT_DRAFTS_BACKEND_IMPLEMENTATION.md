# Backend Implementation — Email Inbox / Sent / Drafts

<!-- Phase-by-phase. Execute one phase at a time. Stop after each phase, report, and wait for "Yes, Proceed". -->

## Problem

`EmailsPage.tsx` only exposes Compose, Campaigns, and Templates. Two already-built frontend components (`EmailList.tsx`, `EmailDetail.tsx`) sit unused, fed only by mock data (`mockEmails.ts`). Real backend support is missing for all three folders, and one of them (Inbox) is missing more than code — there's no inbound-email capability in this project at all.

## Current state, confirmed by reading the code

- **Sent:** every real send already leaves a trace — one-off sends via `send_outreach_email` write to `activities` (`type: 'email'`); campaign sends write to `campaign_recipients` + `email_events`. No new send-side infra needed, just a read-side query that unions both.
- **Drafts:** `EmailsPage.tsx` passes `onSaveDraft={() => {}}` to `ComposeModal` — the Save Draft button currently does **nothing** except show a success toast. No `drafts` table exists anywhere in the migrations.
- **Inbox:** Resend (the only email provider wired up) is send-only here. `resend-webhook/index.ts`'s `EVENT_MAP` only covers `email.opened` / `email.clicked` / `email.bounced` / `email.complained` — there is no event, table, or function anywhere that represents a prospect's incoming reply. `'replied'` exists in `STATUS_PRIORITY` and `STAGE_MAP` as dead code with nothing that ever sets it.

## Phase 0 — Decision, RESOLVED 2026-07-29

Decided: a variant of Option A, using Gmail instead of a dedicated inbound-parse provider. Context that made this the obvious choice: every outreach send already sets `reply_to: lazanpeterpaul@gmail.com` (added 2026-07-27 as a stopgap because the sending domain has no MX record — see commits `89eac5a`, `8e8cb43`). Prospect replies are *already* landing in a real Gmail inbox today; they're just invisible to the CRM. So instead of standing up new inbound-email infrastructure (DNS, Cloudflare Email Routing/Postmark/SendGrid Inbound Parse), Phase 3 syncs from that existing Gmail inbox via the Gmail API.

Two scope decisions confirmed with the user:

- **Sync scope: matched replies only, not the whole inbox.** `lazanpeterpaul@gmail.com` is a personal account, not dedicated to the CRM. The sync must match incoming senders against `prospects.email` and discard (never store) anything that doesn't match — keeps personal email out of the database entirely.
- **Sync mechanism: polling, not push.** A pg_cron-scheduled Edge Function every ~10 minutes, same pattern already used for `send-scheduled-emails`. Real-time Gmail push notifications would need a Google Cloud Pub/Sub topic/subscription — meaningfully more external setup, not justified for a first version.

This also unblocks Phase 4 below (the dead `'replied'` path) for the first time, since matched replies are a real trigger source now.

## Phase 1 — Sent tab data — DONE, simpler than originally scoped

**Correction while implementing:** all three real send paths — `send_outreach_email` (crm-mcp), `send-campaign-batch`, and `send-scheduled-emails` — already write to the same `activities` table (`type = 'email'`) on success. No union with `campaign_recipients` was actually needed; that table only tracks per-recipient campaign status/timestamps, not a duplicate "sent log" — `activities` already is the unified sent log.

**What was actually missing:** none of the three insert call sites persisted the real recipient address or the sent HTML body — only a human-readable `description` string. Fixed:

- New migration `021_activities_email_body.sql` — adds `email_to TEXT` and `email_body TEXT` to `activities`. **Needs to be run manually in the Supabase Dashboard SQL Editor** (no CLI in this project).
- Added `email_to`/`email_body` to the `activities` insert in all three places: `crm-mcp/tools/outreach.ts` (+ its `DEPLOY_BUNDLE.ts` copy), `send-campaign-batch/index.ts`, `send-scheduled-emails/index.ts`. **All three Edge Functions need redeploying** via the Supabase Dashboard for this to take effect on real sends.
- `src/services/sentEmails.service.ts` — single query against `activities` where `type = 'email'`, normalized into the existing `EmailMessage` shape.
- Known limitation: any `activities` row inserted *before* this migration/redeploy (e.g. the earlier Ontario test send) has no `email_to`/`email_body` — the service falls back to showing the old `description` text instead of a real body. Expected, not a bug — only affects historical rows.

## Phase 2 — Drafts (real persistence) — DONE

**Correction while implementing:** the actual template table is `email_templates`, not `rich_templates` (confirmed via `templateService.ts`) — used the real name in the migration.

**Second gap found:** `ComposeModal`'s `onSaveDraft` prop was `() => void` — the parent page had zero access to the modal's actual to/cc/bcc/subject/body/template/prospect state when Save Draft was clicked. Also, `linkedProspect` never stored the prospect's `id` at all, only display fields. Both fixed: `onSaveDraft` now takes a `DraftPayload` argument built from real internal state, and `linkedProspect` carries `id`.

- Migration `022_email_drafts.sql` — `email_drafts` table (`to_emails`/`cc_emails`/`bcc_emails` as `text[]`, `template_id` → `email_templates`, `prospect_id` → `prospects`), RLS scoped to `auth.uid() = user_id`, reuses the existing `update_updated_at_column()` trigger function from `005_campaign_tables.sql`. **Needs to be run manually in the Supabase Dashboard SQL Editor.**
- `src/services/drafts.service.ts`: `createDraft`, `updateDraft`, `listDrafts`, `deleteDraft`
- `src/hooks/useDrafts.ts`
- `EmailsPage.tsx`'s real `onSaveDraft` now creates a new draft, or updates the one being edited (tracked via `editingDraftId`) if resuming an existing one
- Known simplification: resuming a draft only restores `to` (first recipient only)/`subject`/`body` via `ComposeModal`'s existing `initialTo`/`initialSubject`/`initialBody` props — `cc`/`bcc`/linked template/linked prospect are saved correctly in the database but not yet re-populated into the compose UI on resume. Flagging as a known gap, not silently dropped.

## Phase 3 — Inbox: Gmail sync

### 3a — Connect Gmail (OAuth)

- Extend `IntegrationProvider` in `src/services/integrations.service.ts` to include `'gmail'`. No new table needed for token storage — the existing `integrations` table (`provider`, `config` jsonb, `status`, `last_synced_at`) already fits; `config` holds `{ refresh_token, email }`.
- New migration `received_emails` table: `id`, `gmail_message_id` (unique, for dedup), `gmail_thread_id`, `prospect_id` (FK → `prospects.id`, nullable until matched), `from_email`, `from_name`, `to_email`, `subject`, `body_html`, `body_text`, `snippet`, `received_at`, `is_read boolean default false`, `is_starred boolean default false`, `created_at`. RLS: readable by any authenticated CRM user (team-shared inbox concept, not per-user — matches how `lazanpeterpaul@gmail.com` is one shared reply-to for the whole team's outreach).
- New Edge Function `gmail-oauth-callback` — exchanges Google's auth code for `access_token`/`refresh_token`, upserts into `integrations` (`provider: 'gmail'`).
- **Manual steps, only doable by the user (Google Cloud Console + Supabase Dashboard, no CLI):**
  1. Create/select a Google Cloud project, enable the **Gmail API**.
  2. Create OAuth 2.0 credentials (type: Web application), scope `https://www.googleapis.com/auth/gmail.readonly`, authorized redirect URI = the deployed `gmail-oauth-callback` function URL.
  3. Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` as Edge Function secrets via Supabase Dashboard → Edge Functions → Secrets.
  4. Click "Connect Gmail" in the CRM (Settings), complete Google's consent screen once — this captures the refresh token.

### 3b — Sync job

- New Edge Function `gmail-sync`, registered via pg_cron (Dashboard SQL Editor, ~every 10 min — same registration pattern as `send-scheduled-emails`'s cron job).
- Loads the stored `integrations` row for `provider = 'gmail'`, refreshes the access token via the stored refresh token.
- Calls Gmail API `users.messages.list` (scoped to `in:inbox`, bounded by a `last_synced_at`-derived time window to avoid rescanning everything each run), fetches each message's content.
- For each message: match `from` address against `prospects.email` (case-insensitive). **No match → discard, never persisted.** Match → upsert into `received_emails` keyed on `gmail_message_id` (idempotent against re-runs).
- Updates `integrations.last_synced_at`.

## Phase 4 — Wire the dead 'replied' path

`resend-webhook/index.ts` already has `STATUS_PRIORITY`, `STAGE_MAP`, and `autoPipelineUpdate()` (upgrade-only stage progression, auto-creates a deal at stage "Qualified" on first reply) — currently unreachable because nothing ever fires a `'replied'` event. `gmail-sync` (3b) is the first real trigger:

- On each newly-matched reply, insert an `activities` row (`type: 'email'`, `title: 'Email replied'`, `prospect_id`, `completed_at`) — same logging convention `resend-webhook` already uses for opens/clicks.
- Run the same upgrade-only pipeline logic as `autoPipelineUpdate` (extract to a shared helper or duplicate the ~15 lines — small enough that duplication may be simpler than a shared module across two Edge Functions) with `eventType: 'replied'` for the matched `prospect_id`. Note: unlike the webhook, this isn't tied to a specific `campaign_recipients` row (a reply could be to a one-off Compose send, not just a campaign) — key off `prospect_id` directly.
- This makes "Avg Reply Rate" on the Campaigns dashboard a real, non-zero-capable number for the first time.

## Verification, every phase

- `npx tsc -b` clean
- Manual check against real data (not assumptions) before calling a phase done
- Stop and report after each phase; wait for "Yes, Proceed" before the next
