-- Phase 4b (real email threading) of EMAIL_INBOX_SENT_DRAFTS_FRONTEND_IMPLEMENTATION.md
-- Sent replies never touch Gmail at all (they go out via Resend, not through the connected
-- Gmail account), so there's no Gmail-assigned thread id on the sent side to join against
-- received_emails.gmail_thread_id. Instead, the CRM stamps its own thread_id on a sent
-- activity row when it's sent as a reply from an open Inbox thread -- reusing the value of
-- that thread's received_emails.gmail_thread_id purely as a shared grouping key.

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_thread_id ON public.activities(thread_id) WHERE thread_id IS NOT NULL;
