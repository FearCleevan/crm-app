-- ============================================================
-- Brisk CRM — Fix Workflows RLS (Migration 018)
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================
-- Root cause: migration 017 recreated public.workflows and its
-- policies using user_has_permission('workflows_manage'). Per
-- migration 004's documented root cause, user_has_permission()
-- checks crm_users.permissions, a JSONB column that defaults to
-- '{}' for every user, so this check always returns false —
-- blocking every insert/update/delete with a 403, including for
-- Super Admin. Migration 004 already fixed this exact problem for
-- the (now-dropped) old workflows table by switching to
-- get_user_role() checks; 017 accidentally undid that fix when it
-- dropped and recreated the table. This migration reapplies it.
-- ============================================================

DROP POLICY IF EXISTS "workflows_insert" ON public.workflows;
DROP POLICY IF EXISTS "workflows_update" ON public.workflows;
DROP POLICY IF EXISTS "workflows_delete" ON public.workflows;

CREATE POLICY "workflows_insert" ON public.workflows
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('Super Admin', 'Data Analyst'));

CREATE POLICY "workflows_update" ON public.workflows
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('Super Admin', 'Data Analyst'));

CREATE POLICY "workflows_delete" ON public.workflows
  FOR DELETE TO authenticated
  USING (get_user_role() = 'Super Admin');

-- ============================================================
-- Deploy Instructions
-- ============================================================
-- 1. Open Supabase Dashboard → SQL Editor → New Query
-- 2. Paste this entire file and click Run
-- 3. Verify: as a Super Admin or Data Analyst user, creating a
--    workflow in the app should now succeed (no more 403).
-- ============================================================
