-- Phase 3 of EMAIL_INBOX_SENT_DRAFTS_*_IMPLEMENTATION.md
-- ComposeModal's "Save Draft" previously called onSaveDraft={() => {}} in
-- EmailsPage.tsx -- a real no-op. No drafts table existed anywhere.

CREATE TABLE IF NOT EXISTS public.email_drafts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.crm_users(id) ON DELETE CASCADE,
  to_emails   TEXT[] NOT NULL DEFAULT '{}',
  cc_emails   TEXT[] NOT NULL DEFAULT '{}',
  bcc_emails  TEXT[] NOT NULL DEFAULT '{}',
  subject     TEXT,
  body        TEXT,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  prospect_id BIGINT REFERENCES public.prospects(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own drafts" ON public.email_drafts
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_drafts_user_id ON public.email_drafts(user_id);

-- Reuses update_updated_at_column(), already defined in 005_campaign_tables.sql
DROP TRIGGER IF EXISTS trg_email_drafts_updated_at ON public.email_drafts;
CREATE TRIGGER trg_email_drafts_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
