-- Migration 004: Extend email_templates
-- NOTE: We do NOT add user_id — this table already uses created_by (uuid → crm_users.id)
-- This migration only adds the variables column and extends the category CHECK.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Extend category CHECK to include cold outreach types
ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_category_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_category_check
  CHECK (category = ANY (ARRAY[
    'general','follow_up','introduction','proposal','closing',
    're_engagement','newsletter','cold_outreach','no_website','outdated_website'
  ]));
