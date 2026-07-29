-- ============================================================
-- Paul CRM — Gmail Inbox Sync Cron (Migration 024)
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================
-- Schedules a pg_cron job that calls the `gmail-sync` edge function every 10 minutes via
-- pg_net, so real replies to outreach (matched against prospects.email) get pulled from
-- lazanpeterpaul@gmail.com into `received_emails`.
--
-- Requires migration 019 to have been run first (creates the pg_cron/pg_net extensions and
-- the 'project_url' / 'service_role_key' Vault secrets this job also depends on) — same
-- prerequisite as 020_cron_scheduled_emails.sql.
-- Part of Phase 3b, EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md.
-- ============================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'sync-gmail-inbox';

SELECT cron.schedule(
  'sync-gmail-inbox',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
