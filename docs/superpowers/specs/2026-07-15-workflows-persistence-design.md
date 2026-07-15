# Workflows Persistence — Design Spec

Date: 2026-07-15

## Problem

`WorkflowsPage.tsx` (and its supporting components `WorkflowBuilder.tsx`, `WorkflowCard.tsx`,
`WorkflowLog.tsx`) is a fully built UI — create/edit/duplicate/delete/toggle workflows, filter,
search, tabbed run log — but it is 100% client-state. `useWorkflowsState()` seeds from
`MOCK_WORKFLOWS` in `src/constants/mockWorkflows.ts` and every mutation only updates a local
`useState`. Nothing persists across reload; nothing is shared across users.

## Scope

**In scope:** persistence of workflow definitions and a run-log table, wired to Supabase, replacing
the mock/local-state data layer. Same shape as the campaign-frontend-wiring work already completed
(see `2026-07-13-campaign-frontend-wiring.md`).

**Explicitly out of scope:** an execution engine. No trigger actually fires in this iteration —
"New Prospect Added", "Deal Stage Changed", etc. remain configuration only. `run_count` starts at
0 for every workflow going forward and `workflow_runs` starts empty; nothing simulates historical
runs. A future spec can add real trigger wiring + a job runner on top of this schema.

## Schema

New migration `017_workflows_schema.sql` (root `supabase/migrations/`), following the same
structure/RLS conventions as `009_deals_schema.sql`.

```sql
CREATE TABLE public.workflows (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused')),
  trigger       TEXT        NOT NULL CHECK (trigger IN (
                  'new_prospect', 'status_changed', 'deal_stage_changed', 'date_based', 'manual'
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
```

`conditions`/`actions` stay JSONB — they're variable-shape arrays (`WorkflowCondition[]` /
`WorkflowAction[]`) already, and the app only ever reads/writes them wholesale via the builder, so
normalizing into rows would add join complexity with no read/write pattern that needs it.

`workflow_runs` has no `workflow_name` column even though `WorkflowRun.workflowName` exists in the
current type — that field is derivable via a join against `workflows.name` at query time. Denormalizing
it would only make sense once rows survive their parent workflow's deletion, which `ON DELETE CASCADE`
here prevents.

### RLS

Same pattern as `deals`:
- `authenticated_view_workflows` / `authenticated_view_workflow_runs`: any authenticated user can `SELECT`.
- `workflows_insert` / `workflows_update`: requires `user_has_permission('workflows_manage')`.
- `workflows_delete`: requires `user_has_permission('workflows_manage')` OR `get_user_role() = 'Super Admin'`.
- `workflow_runs` has no manage-gated write policy from the client — in this scope nothing writes
  runs (no execution engine), so only a `SELECT` policy is needed. If a future execution engine
  needs to insert runs, it will do so via a service-role edge function, not client-side RLS.

Indexes: `idx_workflows_status`, `idx_workflows_created_at`, `idx_workflow_runs_workflow_id`,
`idx_workflow_runs_created_at`.

## Service layer

New `src/services/workflowService.ts`, mirroring `campaignService.ts`'s conventions:

- `getWorkflows(): Promise<Workflow[]>`
- `createWorkflow(data): Promise<Workflow>`
- `updateWorkflow(id, data): Promise<Workflow>`
- `toggleWorkflowStatus(id): Promise<Workflow>` — flips `active`/`paused`
- `duplicateWorkflow(id): Promise<Workflow>` — server-side copy (new id, `run_count: 0`, `last_run: null`, status forced to `paused`)
- `deleteWorkflow(id): Promise<void>`
- `getWorkflowRuns(): Promise<WorkflowRun[]>` — joined with `workflows.name` for `workflowName`

Row↔type mapping (snake_case columns → camelCase `Workflow`/`WorkflowRun` fields) lives in this
service file, same as other services in the codebase.

## Frontend changes

- `WorkflowsPage.tsx`: `useWorkflowsState()` changes from `useState(MOCK_WORKFLOWS)` to fetching via
  `workflowService.getWorkflows()` on mount (loading/error states follow the same pattern as
  `useSidebarLists`/other data hooks), and each mutation calls the corresponding service method then
  updates local state from the response (or refetches) instead of computing the next state by hand.
- `WorkflowCard.tsx`, `WorkflowBuilder.tsx`: no prop-shape changes — they already consume the
  `Workflow` type, not the mock data directly.
- `WorkflowLog.tsx`: currently reads `MOCK_WORKFLOW_RUNS` directly — needs to accept fetched
  `WorkflowRun[]` as a prop (or call `workflowService.getWorkflowRuns()` itself) instead.
- `src/constants/mockWorkflows.ts`: delete `MOCK_WORKFLOWS` and `MOCK_WORKFLOW_RUNS`. Keep the
  type definitions (`Workflow`, `WorkflowRun`, `WorkflowCondition`, `WorkflowAction`, etc.),
  `TRIGGER_LABELS`/`TRIGGER_ICONS`/`ACTION_LABELS`/`ACTION_COLORS` (UI display constants),
  `WORKFLOW_CONDITION_FIELDS`/`WORKFLOW_OPERATORS` (builder dropdown options), and
  `WORKFLOW_PRESET_TEMPLATES` (builder's "start from template" list — these are starter configs,
  not persisted data, so they stay as static frontend constants).

## Rollout

Migration 017 is a manual Supabase Dashboard SQL Editor step for the user, per established
project convention (no CLI instructions) — same as migrations 008/009 from the campaign work
that are still pending. Frontend work happens on its own branch/worktree; nothing merges to
`main` until the user runs the migration and confirms the page works end-to-end against real data.

## Testing

Manual QA against the running app (no test suite exists in this repo, per prior audit): create a
workflow, refresh the page, confirm it persists; edit, duplicate, delete, toggle status — confirm
each survives reload; confirm the run log renders empty for new workflows and doesn't error when
`workflow_runs` has zero rows.
