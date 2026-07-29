-- Phase 4 of EMAIL_INBOX_SENT_DRAFTS_FRONTEND_IMPLEMENTATION.md
-- 023_received_emails.sql only added SELECT/UPDATE policies -- the real Inbox UI needs to
-- support deleting a message too (EmailList's existing delete action), which needs its own
-- policy since Postgres RLS is deny-by-default per operation.

CREATE POLICY "authenticated_delete_received_emails" ON public.received_emails
  FOR DELETE TO authenticated
  USING (get_user_role() IN ('Super Admin', 'Data Analyst', 'Agent'));
