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
