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
  return ((data ?? []) as unknown as WorkflowRunRow[]).map(mapRunRow)
}
