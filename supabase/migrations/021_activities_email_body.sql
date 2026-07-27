-- Phase 2 of EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md
-- send_outreach_email (crm-mcp/tools/outreach.ts) previously only logged a
-- summary description ("Outreach sent to: x@y.com") on the activities row,
-- never the actual recipient address as a queryable field or the sent HTML
-- body itself — meaning a real Sent view had nothing to render. Adding both.

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS email_to   TEXT,
  ADD COLUMN IF NOT EXISTS email_body TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_email_to ON public.activities(email_to) WHERE email_to IS NOT NULL;
