-- ============================================================
-- Brisk CRM — Scheduled Email Dispatch Cron (Migration 020)
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================
-- Schedules a pg_cron job that calls the `send-scheduled-emails`
-- edge function every 5 minutes via pg_net, so rows in
-- scheduled_emails actually get sent once their scheduled_at
-- time arrives instead of only sitting at status='pending'.
--
-- Requires migration 019 to have been run first (creates the
-- pg_cron/pg_net extensions and the 'project_url' /
-- 'service_role_key' Vault secrets this job also depends on).
-- ============================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'dispatch-scheduled-emails';

SELECT cron.schedule(
  'dispatch-scheduled-emails',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-scheduled-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
