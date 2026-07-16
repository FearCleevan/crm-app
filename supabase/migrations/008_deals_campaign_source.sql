-- ============================================================
-- Brisk CRM — Deals Campaign Source (Migration 008)
-- Run this in Supabase SQL Editor → New Query → Run
-- IMPORTANT: Run AFTER migrations 001–007 (root) and this
-- crm-app-specific set's 004–007 (campaign tables).
-- ============================================================
-- Denormalizes the originating campaign onto deals table,
-- matching the existing pattern of denormalizing prospect_name
-- and company (see 009_deals_schema.sql in root migrations).
-- Lets DealCard show "Via Campaign" without an extra join.
-- ============================================================

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS source_campaign_id uuid
    REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_campaign_name text;

CREATE INDEX IF NOT EXISTS idx_deals_source_campaign_id
  ON public.deals(source_campaign_id)
  WHERE source_campaign_id IS NOT NULL;
