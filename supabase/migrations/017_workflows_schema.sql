-- ============================================================
-- Brisk CRM — Workflows Schema Fix + Run Log (Migration 017)
-- Run this in Supabase SQL Editor → New Query → Run
-- IMPORTANT: Run AFTER migrations 001–016
-- ============================================================
-- Migration 001 created a stub `workflows` table that does not match
-- the application's data model (wrong trigger enum, no `conditions`,
-- no `run_count`/`last_run`, boolean `is_active` instead of a status
-- enum). Same situation the `deals` table was in before migration 009.
-- Safe to run: the app has only ever used mock data, no real rows exist.
-- ============================================================

-- ============================================================
-- Step 1: Drop old workflows table (and its policies, dropped via CASCADE)
-- ============================================================
DROP TABLE IF EXISTS public.workflows CASCADE;

-- ============================================================
-- Step 2: Recreate workflows with the correct schema
-- ============================================================
CREATE TABLE public.workflows (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL DEFAULT 'paused'
                              CHECK (status IN ('active', 'paused')),
  trigger       TEXT        NOT NULL
                              CHECK (trigger IN (
                                'new_prospect', 'status_changed', 'deal_stage_changed',
                                'date_based', 'manual'
                              )),
  conditions    JSONB       NOT NULL DEFAULT '[]',
  actions       JSONB       NOT NULL DEFAULT '[]',
  run_count     INTEGER     NOT NULL DEFAULT 0,
  last_run      TIMESTAMPTZ,
  is_template   BOOLEAN     NOT NULL DEFAULT false,
  created_by    UUID        REFERENCES public.crm_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Step 3: New workflow_runs table (run log — no writer in this
-- migration/app version; reserved for a future execution engine)
-- ============================================================
CREATE TABLE public.workflow_runs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id   UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  record_label  TEXT        NOT NULL,
  record_link   TEXT        NOT NULL,
  duration      TEXT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Step 4: updated_at trigger for workflows
-- (public.set_updated_at() already exists — used by e.g. deals, migration 009)
-- ============================================================
CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Step 5: Row Level Security — workflows
-- ============================================================
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read workflows
CREATE POLICY "authenticated_view_workflows" ON public.workflows
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Requires workflows_manage permission to insert
CREATE POLICY "workflows_insert" ON public.workflows
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('workflows_manage'));

-- Requires workflows_manage permission to update
CREATE POLICY "workflows_update" ON public.workflows
  FOR UPDATE TO authenticated
  USING (user_has_permission('workflows_manage'));

-- Requires workflows_manage OR Super Admin to delete
CREATE POLICY "workflows_delete" ON public.workflows
  FOR DELETE TO authenticated
  USING (
    user_has_permission('workflows_manage')
    OR get_user_role() = 'Super Admin'
  );

-- ============================================================
-- Step 6: Row Level Security — workflow_runs
-- Read-only from the client in this app version: no execution
-- engine exists yet, so no INSERT/UPDATE/DELETE policy is needed.
-- A future execution engine will write via a service-role edge
-- function, which bypasses RLS entirely.
-- ============================================================
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_view_workflow_runs" ON public.workflow_runs
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Step 7: Indexes
-- ============================================================
CREATE INDEX idx_workflows_status          ON public.workflows(status);
CREATE INDEX idx_workflows_created_at      ON public.workflows(created_at DESC);
CREATE INDEX idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_created_at  ON public.workflow_runs(created_at DESC);

-- ============================================================
-- Deploy Instructions
-- ============================================================
-- 1. Open Supabase Dashboard → SQL Editor → New Query
-- 2. Paste this entire file and click Run
-- 3. Verify: Table Editor should show "workflows" with columns
--    id, name, description, status, trigger, conditions, actions,
--    run_count, last_run, is_template, created_by, created_at, updated_at
--    and a new empty "workflow_runs" table.
-- ============================================================
