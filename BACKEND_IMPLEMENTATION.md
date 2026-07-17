# Backend Implementation — Email Send Automation (pg_cron dispatch)

## Problem
Campaigns and "Schedule Send" emails persist to the database correctly
(`campaign_recipients`, `scheduled_emails`) but nothing ever actually sends them.
`send-campaign-batch` (real Resend send logic) exists but nothing invokes it on a
schedule, and there is no dispatcher at all for `scheduled_emails`. No `pg_cron`
job exists anywhere in the project.

## Goal
Wire real, automatic, timed dispatch for both:
1. Active email campaigns (via existing `send-campaign-batch`)
2. One-off scheduled sends (via a new `send-scheduled-emails` function)

using `pg_cron` + `pg_net` (the standard Supabase pattern for cron-triggered edge
function calls), fully configured through SQL migrations + the Supabase Dashboard
(no CLI steps, per project convention).

---

## Phase 1 — Enable extensions + schedule campaign batch dispatch
- New migration `019_cron_campaign_dispatch.sql`:
  - `CREATE EXTENSION IF NOT EXISTS pg_cron;`
  - `CREATE EXTENSION IF NOT EXISTS pg_net;`
  - `cron.schedule(...)` job named `dispatch-campaign-batch`, every 15 minutes,
    calling `send-campaign-batch` via `net.http_post` (using the project's
    Edge Function URL + service role key stored as a Vault secret or
    `current_setting`).
- Verify job appears in `cron.job` table.

## Phase 2 — Build `send-scheduled-emails` edge function
- New function `supabase/functions/send-scheduled-emails/index.ts`:
  - Query `scheduled_emails` where `status = 'pending'` and `scheduled_at <= now()`.
  - Send each via Resend (same pattern as `send-email`), respecting
    `to/cc/bcc_addresses`.
  - On success: `status = 'sent'`, `sent_at = now()`.
  - On failure: `status = 'failed'`, `error_message` set — no silent retries.
- Deploy via Supabase Dashboard → Edge Functions → Deploy new function
  (step-by-step guide included in Phase 2 report, no CLI).

## Phase 3 — Schedule scheduled-email dispatch
- New migration `020_cron_scheduled_emails.sql`:
  - `cron.schedule(...)` job named `dispatch-scheduled-emails`, every 5 minutes,
    calling `send-scheduled-emails` the same way as Phase 1.

## Phase 4 — Secrets + config verification
- Confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in
  Supabase Dashboard → Edge Functions → Secrets (guide provided, no CLI).
- Confirm the service-role key / project URL used by the cron jobs is stored
  safely (Vault secret, not hardcoded in the migration SQL).

## Phase 5 — End-to-end verification
- Set one real test campaign to `status: active` with a real recipient.
- Create one real "Schedule Send" for ~2 minutes in the future.
- Wait for both cron jobs to fire naturally (no manual invocation).
- Confirm: real email received, `campaign_recipients`/`scheduled_emails` rows
  flip to `sent`, `email_events` row logged for the campaign send.

---

Each phase stops for "Yes, Proceed" before continuing, per standing workflow.
