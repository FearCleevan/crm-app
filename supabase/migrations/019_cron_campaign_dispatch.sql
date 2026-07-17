-- ============================================================
-- Brisk CRM — Campaign Batch Dispatch Cron (Migration 019)
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================
-- Schedules a pg_cron job that calls the existing
-- `send-campaign-batch` edge function every 15 minutes via pg_net,
-- so active campaigns actually get dispatched instead of only
-- sitting in campaign_recipients with status='pending'.
--
-- IMPORTANT — before running this file, store two Vault secrets
-- (Supabase Dashboard → Project Settings → Vault → New secret),
-- or run the two vault.create_secret calls below with your real
-- values filled in (then delete the values from this file/history
-- before committing — do not leave real keys in source control):
--
--   name: project_url          value: https://<your-project-ref>.supabase.co
--   name: service_role_key     value: <your Supabase service_role key>
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove any previous job with the same name before re-scheduling
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'dispatch-campaign-batch';

SELECT cron.schedule(
  'dispatch-campaign-batch',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-campaign-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
