export type TriggerType = 'new_prospect' | 'status_changed' | 'deal_stage_changed' | 'date_based' | 'manual'
export type ActionType  = 'send_email' | 'create_task' | 'update_field' | 'notify_user' | 'add_segment'
export type WorkflowStatus = 'active' | 'paused'
export type RunStatus = 'success' | 'failed' | 'skipped'

export interface WorkflowCondition {
  id: string
  field: string
  operator: string
  value: string
}

export interface WorkflowAction {
  id: string
  type: ActionType
  config: Record<string, string>
}

export interface Workflow {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  trigger: TriggerType
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  runCount: number
  lastRun: string | null
  createdOn: string
  isTemplate?: boolean
}

export interface WorkflowRun {
  id: string
  workflowId: string
  workflowName: string
  status: RunStatus
  recordLabel: string
  recordLink: string
  timestamp: string
  duration: string
  error?: string
}

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  new_prospect:       'New Prospect Added',
  status_changed:     'Prospect Status Changed',
  deal_stage_changed: 'Deal Stage Changed',
  date_based:         'Date-Based',
  manual:             'Manual Trigger',
}

export const TRIGGER_ICONS: Record<TriggerType, string> = {
  new_prospect:       '👤',
  status_changed:     '🔄',
  deal_stage_changed: '📊',
  date_based:         '📅',
  manual:             '▶️',
}

export const ACTION_LABELS: Record<ActionType, string> = {
  send_email:   'Send Email',
  create_task:  'Create Task',
  update_field: 'Update Field',
  notify_user:  'Notify User',
  add_segment:  'Add to Segment',
}

export const ACTION_COLORS: Record<ActionType, string> = {
  send_email:   'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  create_task:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  update_field: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  notify_user:  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  add_segment:  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
}

export const WORKFLOW_CONDITION_FIELDS = [
  'Status', 'Country', 'Industry', 'Seniority', 'Employee Size', 'Annual Revenue',
  'Email Status', 'Disposition', 'Provider', 'Created Date', 'Deal Stage', 'Deal Value',
]

export const WORKFLOW_OPERATORS = ['equals', 'not equals', 'contains', 'greater than', 'less than', 'is empty', 'is not empty']

export const WORKFLOW_PRESET_TEMPLATES: Pick<Workflow, 'name' | 'description' | 'trigger' | 'conditions' | 'actions'>[] = [
  {
    name: 'Welcome Email on New Lead',
    description: 'Send a welcome email when a new prospect is created.',
    trigger: 'new_prospect',
    conditions: [],
    actions: [{ id: 'a1', type: 'send_email', config: { template: 'Introduction Email', delay: '0 minutes' } }],
  },
  {
    name: 'Follow-up if No Response in 3 Days',
    description: 'Remind the team and send a follow-up when prospect is unresponsive.',
    trigger: 'date_based',
    conditions: [{ id: 'c1', field: 'Status', operator: 'equals', value: 'Contacted' }],
    actions: [
      { id: 'a1', type: 'send_email',  config: { template: 'Follow-up After Demo', delay: '3 days' } },
      { id: 'a2', type: 'notify_user', config: { message: 'Prospect not responding', channel: 'In-app' } },
    ],
  },
  {
    name: 'Assign to Manager on Deal > $10k',
    description: 'Escalate and reassign high-value deals automatically.',
    trigger: 'deal_stage_changed',
    conditions: [{ id: 'c1', field: 'Deal Value', operator: 'greater than', value: '10000' }],
    actions: [
      { id: 'a1', type: 'update_field', config: { field: 'Assigned To', value: 'Sales Manager' } },
      { id: 'a2', type: 'notify_user',  config: { message: 'High-value deal needs your attention', channel: 'Email' } },
    ],
  },
]
