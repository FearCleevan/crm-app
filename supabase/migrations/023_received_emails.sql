-- Phase 3a of EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md
-- Real Inbox data via Gmail sync (Phase 0 decision, resolved 2026-07-29). Team-shared table,
-- not user-scoped -- lazanpeterpaul@gmail.com is one shared reply-to address for the whole
-- team's outreach, matching prospects.email. Only messages that match a real prospect are
-- ever synced in here (see gmail-sync Edge Function) -- unmatched personal mail never lands
-- in this table at all.

CREATE TABLE IF NOT EXISTS public.received_emails (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id  TEXT,
  prospect_id      BIGINT REFERENCES public.prospects(id) ON DELETE SET NULL,
  from_email       TEXT NOT NULL,
  from_name        TEXT,
  to_email         TEXT,
  subject          TEXT,
  body_html        TEXT,
  body_text        TEXT,
  snippet          TEXT,
  received_at      TIMESTAMPTZ NOT NULL,
  is_read          BOOLEAN NOT NULL DEFAULT false,
  is_starred       BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;

-- Note: user_has_permission() always returns false (permissions JSONB column is never
-- populated) -- use get_user_role() instead, per the established fix in 004_fix_rls_policies.sql.
CREATE POLICY "authenticated_view_received_emails" ON public.received_emails
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('Super Admin', 'Data Analyst', 'Agent'));

CREATE POLICY "authenticated_update_received_emails" ON public.received_emails
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('Super Admin', 'Data Analyst', 'Agent'));

CREATE INDEX IF NOT EXISTS idx_received_emails_prospect_id  ON public.received_emails(prospect_id);
CREATE INDEX IF NOT EXISTS idx_received_emails_received_at  ON public.received_emails(received_at DESC);
