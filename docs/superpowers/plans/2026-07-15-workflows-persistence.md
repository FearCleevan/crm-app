# Workflows Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Workflows page's mock/client-state data layer with real Supabase persistence (workflow definitions + an empty run log), with no execution engine in scope.

**Architecture:** A new migration drops the mismatched stub `workflows` table (created in migration 001, never matching the app's data model) and recreates it to match the `Workflow` type, plus adds a new `workflow_runs` table. A new `workflowService.ts` wraps all reads/writes with snake_case↔camelCase row mapping. `WorkflowsPage.tsx`'s `useWorkflowsState` hook is rewritten to call the service instead of mutating `useState(MOCK_WORKFLOWS)`. `WorkflowLog.tsx` is changed to accept fetched runs via props instead of importing mock data directly.

**Tech Stack:** React + Vite, TypeScript, Supabase (Postgres + RLS), `@supabase/supabase-js` client at `src/lib/supabase.ts`, `sonner` for toasts.

## Global Constraints

- No test framework is configured in this repo (no Jest/Vitest, confirmed by prior codebase audit). Every task is verified by running the dev server (`npm run dev`) and exercising the feature in the browser, not by automated tests.
- Migrations are run manually via the Supabase Dashboard SQL Editor — never via CLI — per project convention. Every migration task ends with "run this in the Dashboard" instructions for the human, not a command this plan can execute itself.
- No execution engine: `run_count` starts at 0, `workflow_runs` starts empty, no code path creates a run row in this plan. Triggers/actions remain configuration-only.
- Follow the existing snake_case-DB / camelCase-frontend-type split already used by `campaignService.ts`/`notes.service.ts` — do not rename existing frontend field names (`runCount`, `lastRun`, `createdOn`, `isTemplate`, `workflowName`, etc.) since `WorkflowCard.tsx` and `WorkflowBuilder.tsx` already consume them and must not change.
- Keep `docs: false` — i.e. don't add a test suite, don't refactor unrelated code, don't touch `WorkflowBuilder.tsx` or `WorkflowCard.tsx` (their prop interfaces already match what's needed).

---

### Task 1: Migration 017 — workflows schema fix + workflow_runs table

**Files:**
- Create: `supabase/migrations/017_workflows_schema.sql`

**Interfaces:**
- Produces: tables `public.workflows` (id, name, description, status, trigger, conditions jsonb, actions jsonb, run_count, last_run, is_template, created_by, created_at, updated_at) and `public.workflow_runs` (id, workflow_id, status, record_label, record_link, duration, error, created_at). These are consumed by Task 2's `workflowService.ts`.

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Verify `public.set_updated_at()` and `public.user_has_permission()` / `public.get_user_role()` exist**

These are shared functions reused from earlier migrations (`009_deals_schema.sql` uses `set_updated_at`; `003_rls_policies.sql` uses `user_has_permission`/`get_user_role`). Run this read-only check in the Supabase Dashboard SQL Editor before applying migration 017:

```sql
SELECT proname FROM pg_proc WHERE proname IN ('set_updated_at', 'user_has_permission', 'get_user_role');
```

Expected: all three rows returned. If any are missing, stop and report — do not redefine them in migration 017, they're owned by earlier migrations.

- [ ] **Step 3: Ask the human to run the migration**

Tell the user: "Migration `017_workflows_schema.sql` is ready. Please run it in the Supabase Dashboard SQL Editor (New Query → paste the file → Run), then confirm the `workflows` and `workflow_runs` tables appear in the Table Editor with the columns listed in the deploy instructions."

Do not proceed to Task 2's manual verification until the human confirms the migration ran successfully — Task 2 can still be written/committed without a live DB, but its runtime check requires the tables to exist.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/017_workflows_schema.sql
git commit -m "feat: add workflows persistence schema (migration 017)"
```

---

### Task 2: `workflowService.ts` — Supabase-backed CRUD

**Files:**
- Create: `src/services/workflowService.ts`
- Reference (read-only, no edits): `src/constants/mockWorkflows.ts` for the `Workflow`/`WorkflowRun`/`WorkflowCondition`/`WorkflowAction` type shapes
- Reference (read-only, no edits): `src/lib/supabase.ts` for the `supabase` client, `src/services/campaignService.ts` for the module's function-export style

**Interfaces:**
- Consumes: `Workflow`, `WorkflowRun`, `WorkflowCondition`, `WorkflowAction`, `WorkflowStatus`, `TriggerType` types from `@/constants/mockWorkflows` (unchanged in this task).
- Produces (consumed by Task 4 in `WorkflowsPage.tsx`):
  - `getWorkflows(): Promise<Workflow[]>`
  - `createWorkflow(data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>, createdBy: string): Promise<Workflow>`
  - `updateWorkflow(id: string, data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>): Promise<Workflow>`
  - `toggleWorkflowStatus(id: string, nextStatus: WorkflowStatus): Promise<Workflow>`
  - `duplicateWorkflow(source: Workflow, createdBy: string): Promise<Workflow>`
  - `deleteWorkflow(id: string): Promise<void>`
  - `getWorkflowRuns(): Promise<WorkflowRun[]>`

- [ ] **Step 1: Write the service file**

```typescript
import { supabase } from '@/lib/supabase'
import type { Workflow, WorkflowRun, WorkflowStatus } from '@/constants/mockWorkflows'

interface WorkflowRow {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  trigger: Workflow['trigger']
  conditions: Workflow['conditions']
  actions: Workflow['actions']
  run_count: number
  last_run: string | null
  is_template: boolean
  created_at: string
}

interface WorkflowRunRow {
  id: string
  workflow_id: string
  status: WorkflowRun['status']
  record_label: string
  record_link: string
  duration: string | null
  error: string | null
  created_at: string
  workflows: { name: string } | null
}

function mapWorkflowRow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    trigger: row.trigger,
    conditions: row.conditions,
    actions: row.actions,
    runCount: row.run_count,
    lastRun: row.last_run,
    createdOn: row.created_at,
    isTemplate: row.is_template,
  }
}

function mapRunRow(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowName: row.workflows?.name ?? 'Unknown Workflow',
    status: row.status,
    recordLabel: row.record_label,
    recordLink: row.record_link,
    timestamp: row.created_at,
    duration: row.duration ?? '—',
    error: row.error ?? undefined,
  }
}

const WORKFLOW_COLUMNS = 'id, name, description, status, trigger, conditions, actions, run_count, last_run, is_template, created_at'

export async function getWorkflows(): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select(WORKFLOW_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as WorkflowRow[]).map(mapWorkflowRow)
}

export async function createWorkflow(
  data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>,
  createdBy: string
): Promise<Workflow> {
  const { data: result, error } = await supabase
    .from('workflows')
    .insert({
      name:        data.name,
      description: data.description,
      status:      data.status,
      trigger:     data.trigger,
      conditions:  data.conditions,
      actions:     data.actions,
      is_template: data.isTemplate ?? false,
      created_by:  createdBy,
    })
    .select(WORKFLOW_COLUMNS)
    .single()
  if (error) throw error
  return mapWorkflowRow(result as WorkflowRow)
}

export async function updateWorkflow(
  id: string,
  data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>
): Promise<Workflow> {
  const { data: result, error } = await supabase
    .from('workflows')
    .update({
      name:        data.name,
      description: data.description,
      status:      data.status,
      trigger:     data.trigger,
      conditions:  data.conditions,
      actions:     data.actions,
      is_template: data.isTemplate ?? false,
    })
    .eq('id', id)
    .select(WORKFLOW_COLUMNS)
    .single()
  if (error) throw error
  return mapWorkflowRow(result as WorkflowRow)
}

export async function toggleWorkflowStatus(id: string, nextStatus: WorkflowStatus): Promise<Workflow> {
  const { data: result, error } = await supabase
    .from('workflows')
    .update({ status: nextStatus })
    .eq('id', id)
    .select(WORKFLOW_COLUMNS)
    .single()
  if (error) throw error
  return mapWorkflowRow(result as WorkflowRow)
}

export async function duplicateWorkflow(source: Workflow, createdBy: string): Promise<Workflow> {
  const { data: result, error } = await supabase
    .from('workflows')
    .insert({
      name:        `${source.name} (Copy)`,
      description: source.description,
      status:      'paused',
      trigger:     source.trigger,
      conditions:  source.conditions,
      actions:     source.actions,
      is_template: false,
      created_by:  createdBy,
    })
    .select(WORKFLOW_COLUMNS)
    .single()
  if (error) throw error
  return mapWorkflowRow(result as WorkflowRow)
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getWorkflowRuns(): Promise<WorkflowRun[]> {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('id, workflow_id, status, record_label, record_link, duration, error, created_at, workflows (name)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return ((data ?? []) as WorkflowRunRow[]).map(mapRunRow)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (this file has no consumers yet, so it can't produce runtime errors, but must type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add src/services/workflowService.ts
git commit -m "feat: add workflowService with Supabase-backed CRUD"
```

---

### Task 3: Remove mock data constants from `mockWorkflows.ts`

**Files:**
- Modify: `src/constants/mockWorkflows.ts:86-213` (removes `MOCK_WORKFLOWS` and `MOCK_WORKFLOW_RUNS`; keeps everything else — types, `TRIGGER_LABELS`, `TRIGGER_ICONS`, `ACTION_LABELS`, `ACTION_COLORS`, `WORKFLOW_CONDITION_FIELDS`, `WORKFLOW_OPERATORS`, `WORKFLOW_PRESET_TEMPLATES`)

**Interfaces:**
- Consumes: nothing new.
- Produces: same exported types as before (`Workflow`, `WorkflowRun`, etc. — unchanged), minus `MOCK_WORKFLOWS`/`MOCK_WORKFLOW_RUNS` which Task 4 and Task 5 must no longer import.

- [ ] **Step 1: Delete the two mock arrays**

In `src/constants/mockWorkflows.ts`, delete lines 86–182 (the `export const MOCK_WORKFLOWS: Workflow[] = [...]` block through the end of `export const MOCK_WORKFLOW_RUNS: WorkflowRun[] = [...]`), keeping `export const WORKFLOW_PRESET_TEMPLATES = [...]` (lines 184–212) and everything above line 86 unchanged.

- [ ] **Step 2: Verify no remaining references**

Run: `grep -rn "MOCK_WORKFLOWS\|MOCK_WORKFLOW_RUNS" src/`
Expected: no matches (Tasks 4 and 5, done next, will have already been rewritten not to import them — if this task is executed before Tasks 4/5 in isolation, expect matches in `WorkflowsPage.tsx` and `WorkflowLog.tsx` until those tasks land; note this in the task handoff rather than treating it as a failure).

- [ ] **Step 3: Commit**

```bash
git add src/constants/mockWorkflows.ts
git commit -m "chore: remove workflow mock data, keep types and display constants"
```

---

### Task 4: Wire `WorkflowsPage.tsx` to `workflowService`

**Files:**
- Modify: `src/pages/WorkflowsPage.tsx` (entire `useWorkflowsState` function, lines 15–56, plus its call site and the `handleSave` function, lines 83–91)

**Interfaces:**
- Consumes: `getWorkflows`, `createWorkflow`, `updateWorkflow`, `toggleWorkflowStatus`, `duplicateWorkflow`, `deleteWorkflow` from `@/services/workflowService` (Task 2); `useAuth` from `@/context/AuthContext` (existing, returns `{ user }` where `user.id` is the `crm_users.id` to use as `createdBy` — confirmed via `NotesPage.tsx:446`'s `currentUserId={user?.id ?? ''}` usage).
- Produces: `WorkflowsPage` now renders real data; no prop-shape change to `WorkflowCard`/`WorkflowBuilder`.

- [ ] **Step 1: Replace `useWorkflowsState`**

Replace lines 1–56 of `src/pages/WorkflowsPage.tsx` (imports through the end of `useWorkflowsState`) with:

```typescript
import { useState, useCallback, useMemo, useEffect } from 'react'
import { Plus, Zap, Play, BarChart2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { WorkflowCard } from '@/components/workflows/WorkflowCard'
import { WorkflowBuilder } from '@/components/workflows/WorkflowBuilder'
import { WorkflowLog } from '@/components/workflows/WorkflowLog'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/context/AuthContext'
import * as workflowService from '@/services/workflowService'
import { type Workflow, type WorkflowRun } from '@/constants/mockWorkflows'
import { cn } from '@/lib/utils'

type Tab = 'workflows' | 'log'

function useWorkflowsState(createdBy: string) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wf, wr] = await Promise.all([
        workflowService.getWorkflows(),
        workflowService.getWorkflowRuns(),
      ])
      setWorkflows(wf)
      setRuns(wr)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>) => {
    try {
      const wf = await workflowService.createWorkflow(data, createdBy)
      setWorkflows(prev => [wf, ...prev])
      toast.success(`Workflow "${wf.name}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create workflow')
    }
  }, [createdBy])

  const update = useCallback(async (id: string, data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>) => {
    try {
      const wf = await workflowService.updateWorkflow(id, data)
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w))
      toast.success('Workflow updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update workflow')
    }
  }, [])

  const toggle = useCallback(async (id: string) => {
    const current = workflows.find(w => w.id === id)
    if (!current) return
    const next = current.status === 'active' ? 'paused' : 'active'
    try {
      const wf = await workflowService.toggleWorkflowStatus(id, next)
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w))
      toast.success(`Workflow ${next === 'active' ? 'activated' : 'paused'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update workflow status')
    }
  }, [workflows])

  const duplicate = useCallback(async (source: Workflow) => {
    try {
      const wf = await workflowService.duplicateWorkflow(source, createdBy)
      setWorkflows(prev => [wf, ...prev])
      toast.success('Workflow duplicated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate workflow')
    }
  }, [createdBy])

  const remove = useCallback(async (id: string) => {
    try {
      await workflowService.deleteWorkflow(id)
      setWorkflows(prev => prev.filter(w => w.id !== id))
      toast.success('Workflow deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete workflow')
    }
  }, [])

  return { workflows, runs, loading, add, update, toggle, duplicate, remove }
}
```

- [ ] **Step 2: Update the component body to use the new hook shape**

In the `WorkflowsPage` function (was line 58 in the original file), replace:

```typescript
export function WorkflowsPage() {
  const { workflows, add, update, toggle, duplicate, remove } = useWorkflowsState()
```

with:

```typescript
export function WorkflowsPage() {
  const { user } = useAuth()
  const { workflows, runs, loading, add, update, toggle, duplicate, remove } = useWorkflowsState(user?.id ?? '')
```

- [ ] **Step 3: Update `handleSave` to match the new `update` signature**

Replace the existing `handleSave` function:

```typescript
  function handleSave(data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>) {
    if (editing) {
      update({ ...editing, ...data })
      setEditing(null)
    } else {
      add(data)
    }
    setBuilderOpen(false)
  }
```

with:

```typescript
  function handleSave(data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>) {
    if (editing) {
      update(editing.id, data)
      setEditing(null)
    } else {
      add(data)
    }
    setBuilderOpen(false)
  }
```

- [ ] **Step 4: Pass `runs`/`loading` down to `WorkflowLog` and show a loading state for the grid**

Replace `{tab === 'log' && <WorkflowLog />}` with `{tab === 'log' && <WorkflowLog runs={runs} loading={loading} />}`.

Replace the `{filtered.length === 0 ? (` branch's opening condition to account for loading — change:

```typescript
          {tab === 'workflows' && (
            <>
              {filtered.length === 0 ? (
```

to:

```typescript
          {tab === 'workflows' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading workflows…</div>
              ) : filtered.length === 0 ? (
```

(This adds one more `) : (` — the existing `filtered.length === 0 ? (...) : (...)` ternary becomes a three-way `loading ? (...) : filtered.length === 0 ? (...) : (...)`; no other lines in that block change.)

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors. If `WorkflowLog` reports a prop-type error, that's expected until Task 5 lands — note it in the task handoff, don't fix it here.

- [ ] **Step 6: Commit**

```bash
git add src/pages/WorkflowsPage.tsx
git commit -m "feat: wire WorkflowsPage to workflowService instead of mock state"
```

---

### Task 5: Wire `WorkflowLog.tsx` to accept real runs via props

**Files:**
- Modify: `src/components/workflows/WorkflowLog.tsx` (entire file)

**Interfaces:**
- Consumes: `runs: WorkflowRun[]` and `loading: boolean` props, passed from `WorkflowsPage.tsx` (Task 4).
- Produces: no more direct import of `MOCK_WORKFLOW_RUNS`.

- [ ] **Step 1: Replace the import and component signature**

Change:

```typescript
import { MOCK_WORKFLOW_RUNS, type WorkflowRun } from '@/constants/mockWorkflows'
```

to:

```typescript
import { type WorkflowRun } from '@/constants/mockWorkflows'
```

Change:

```typescript
export function WorkflowLog() {
```

to:

```typescript
interface WorkflowLogProps {
  runs: WorkflowRun[]
  loading: boolean
}

export function WorkflowLog({ runs, loading }: WorkflowLogProps) {
```

- [ ] **Step 2: Replace the data source and add loading/empty states**

Change `{MOCK_WORKFLOW_RUNS.map(run => {` to `{runs.map(run => {`.

Wrap the `<div className="divide-y divide-border">...</div>` block: change

```typescript
      <div className="divide-y divide-border">
        {runs.map(run => {
```

to:

```typescript
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading run log…</div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Clock className="h-8 w-8 opacity-20" />
          <p className="text-sm font-medium">No runs yet</p>
          <p className="text-xs">Workflow runs will appear here once automations start executing</p>
        </div>
      ) : (
      <div className="divide-y divide-border">
        {runs.map(run => {
```

and change the closing of that block from:

```typescript
        })}
      </div>
    </div>
  )
}
```

to:

```typescript
        })}
      </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/workflows/WorkflowLog.tsx
git commit -m "feat: wire WorkflowLog to real run data via props"
```

---

### Task 6: End-to-end manual verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1–5, plus a live Supabase project with migration 017 applied (confirm with the human before starting this task — if not yet applied, stop and ask them to run it first).

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: 0 errors.

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Open the app, log in, navigate to Workflows.

- [ ] **Step 3: Exercise create → reload → confirm persistence**

Create a new workflow via "New Workflow" (any trigger/action). Confirm it appears in the grid with `0 runs` / `Last: Never`. Refresh the browser page. Confirm the workflow is still there (proves it round-tripped through Supabase, not just local state).

- [ ] **Step 4: Exercise edit, toggle, duplicate, delete**

Edit the workflow's name, save, confirm the change persists after refresh. Toggle its status (Active ↔ Paused) via the card switch, confirm it persists after refresh. Duplicate it, confirm a `"<name> (Copy)"` row appears paused with 0 runs. Delete the duplicate, confirm it's gone after refresh.

- [ ] **Step 5: Exercise the Run Log tab**

Switch to the "Run Log" tab. Confirm it shows the "No runs yet" empty state (since migration 017 leaves `workflow_runs` empty and this plan adds no writer) rather than erroring or showing stale mock data.

- [ ] **Step 6: Confirm permission gating still works**

If a non-manager test account is available, confirm the "New Workflow" button and per-card edit/delete actions are hidden per the existing `PermissionGate permission="workflows_manage"` checks (unchanged by this plan — this just confirms the RLS write policies added in Task 1 don't conflict with the existing UI-level gate).

- [ ] **Step 7: Report results to the human**

Summarize pass/fail for each of steps 3–6. Do not merge any branch or mark the feature done until the human confirms they're satisfied with the manual QA pass.
