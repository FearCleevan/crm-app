-- Migration 007: Add UNIQUE constraint to integrations table
-- Required before any upsert with onConflict:'user_id,provider'

ALTER TABLE public.integrations
  ADD CONSTRAINT IF NOT EXISTS integrations_user_provider_unique
  UNIQUE (user_id, provider);
