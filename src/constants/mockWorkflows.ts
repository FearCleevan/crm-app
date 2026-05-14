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

const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString()

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

export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-001', name: 'Welcome Email on New Lead', status: 'active',
    trigger: 'new_prospect', runCount: 484, lastRun: d(0),
    description: 'Automatically sends a welcome introduction email when a new prospect is added to the CRM.',
    createdOn: d(30),
    conditions: [],
    actions: [
      { id: 'a1', type: 'send_email',  config: { template: 'Introduction Email', delay: '0 minutes' } },
      { id: 'a2', type: 'create_task', config: { title: 'Follow up within 24h', assignTo: 'Assigned User', dueIn: '1 day' } },
    ],
  },
  {
    id: 'wf-002', name: 'Follow-up if No Response (3 Days)', status: 'active',
    trigger: 'date_based', runCount: 127, lastRun: d(1),
    description: 'Sends a follow-up email if the prospect has not replied within 3 days of initial contact.',
    createdOn: d(25),
    conditions: [
      { id: 'c1', field: 'Status', operator: 'equals', value: 'Contacted' },
      { id: 'c2', field: 'Email Status', operator: 'equals', value: 'Valid' },
    ],
    actions: [
      { id: 'a1', type: 'send_email',  config: { template: 'Follow-up After Demo', delay: '3 days' } },
      { id: 'a2', type: 'notify_user', config: { message: 'Prospect not responding — consider calling', channel: 'In-app' } },
    ],
  },
  {
    id: 'wf-003', name: 'Assign to Manager on High-Value Deal', status: 'active',
    trigger: 'deal_stage_changed', runCount: 23, lastRun: d(2),
    description: 'Escalates deals over $10,000 to the Sales Manager with a notification.',
    createdOn: d(20),
    conditions: [
      { id: 'c1', field: 'Deal Value', operator: 'greater than', value: '10000' },
    ],
    actions: [
      { id: 'a1', type: 'update_field', config: { field: 'Assigned To', value: 'Sales Manager' } },
      { id: 'a2', type: 'notify_user',  config: { message: 'High-value deal assigned to you', channel: 'Email + In-app' } },
      { id: 'a3', type: 'create_task',  config: { title: 'Schedule executive call', assignTo: 'Sales Manager', dueIn: '2 days' } },
    ],
  },
  {
    id: 'wf-004', name: 'Prospect Status Changed → Qualified', status: 'paused',
    trigger: 'status_changed', runCount: 61, lastRun: d(7),
    description: 'When a prospect is qualified, creates a linked deal and notifies the team.',
    createdOn: d(18),
    conditions: [
      { id: 'c1', field: 'Status', operator: 'equals', value: 'Qualified' },
    ],
    actions: [
      { id: 'a1', type: 'create_task',  config: { title: 'Create deal in pipeline', assignTo: 'Assigned User', dueIn: '0 days' } },
      { id: 'a2', type: 'notify_user',  config: { message: 'New qualified prospect ready for deal creation', channel: 'In-app' } },
      { id: 'a3', type: 'add_segment',  config: { segment: 'Qualified Leads' } },
    ],
  },
  {
    id: 'wf-005', name: 'Monthly Re-engagement Campaign', status: 'paused',
    trigger: 'date_based', runCount: 3, lastRun: d(30),
    description: 'Monthly email to prospects with no activity in the last 60 days.',
    createdOn: d(90),
    conditions: [
      { id: 'c1', field: 'Status', operator: 'equals', value: 'New' },
      { id: 'c2', field: 'Created Date', operator: 'greater than', value: '60 days ago' },
    ],
    actions: [
      { id: 'a1', type: 'send_email',  config: { template: 'Re-engagement', delay: '0 minutes' } },
      { id: 'a2', type: 'add_segment', config: { segment: 'Re-engagement Campaign' } },
    ],
  },
  {
    id: 'wf-006', name: 'Deal Closed Won → Onboarding', status: 'active',
    trigger: 'deal_stage_changed', runCount: 18, lastRun: d(3),
    description: 'Triggers onboarding sequence when a deal is marked Closed Won.',
    createdOn: d(15),
    conditions: [
      { id: 'c1', field: 'Deal Stage', operator: 'equals', value: 'Closed Won' },
    ],
    actions: [
      { id: 'a1', type: 'send_email',   config: { template: 'Welcome — New Customer', delay: '0 minutes' } },
      { id: 'a2', type: 'update_field', config: { field: 'Status', value: 'Closed' } },
      { id: 'a3', type: 'create_task',  config: { title: 'Schedule onboarding kickoff call', assignTo: 'CS Team', dueIn: '1 day' } },
      { id: 'a4', type: 'add_segment',  config: { segment: 'Active Customers' } },
    ],
  },
]

export const MOCK_WORKFLOW_RUNS: WorkflowRun[] = [
  { id: 'r1',  workflowId: 'wf-001', workflowName: 'Welcome Email on New Lead',               status: 'success', recordLabel: 'Alice Johnson — TechCorp',         recordLink: '/prospects', timestamp: d(0),  duration: '1.2s'  },
  { id: 'r2',  workflowId: 'wf-001', workflowName: 'Welcome Email on New Lead',               status: 'success', recordLabel: 'Marcus Lee — FinGroup',            recordLink: '/prospects', timestamp: d(0),  duration: '0.9s'  },
  { id: 'r3',  workflowId: 'wf-003', workflowName: 'Assign to Manager on High-Value Deal',    status: 'success', recordLabel: 'RetailCo — Enterprise Deal ($42k)', recordLink: '/deals',     timestamp: d(1),  duration: '0.5s'  },
  { id: 'r4',  workflowId: 'wf-002', workflowName: 'Follow-up if No Response (3 Days)',       status: 'success', recordLabel: 'James Patel — CloudStartup',        recordLink: '/prospects', timestamp: d(1),  duration: '1.8s'  },
  { id: 'r5',  workflowId: 'wf-006', workflowName: 'Deal Closed Won → Onboarding',            status: 'success', recordLabel: 'Sarah Nguyen — RetailCo',           recordLink: '/deals',     timestamp: d(2),  duration: '2.1s'  },
  { id: 'r6',  workflowId: 'wf-001', workflowName: 'Welcome Email on New Lead',               status: 'failed',  recordLabel: 'Unknown Prospect',                 recordLink: '/prospects', timestamp: d(2),  duration: '—',    error: 'Invalid email address' },
  { id: 'r7',  workflowId: 'wf-002', workflowName: 'Follow-up if No Response (3 Days)',       status: 'skipped', recordLabel: 'Emily Watson — ConsultCo',          recordLink: '/prospects', timestamp: d(3),  duration: '—'     },
  { id: 'r8',  workflowId: 'wf-004', workflowName: 'Prospect Status Changed → Qualified',     status: 'success', recordLabel: 'David Kim — StartupCo',             recordLink: '/prospects', timestamp: d(4),  duration: '0.7s'  },
  { id: 'r9',  workflowId: 'wf-003', workflowName: 'Assign to Manager on High-Value Deal',    status: 'success', recordLabel: 'NovaTech — Partnership ($18k)',      recordLink: '/deals',     timestamp: d(5),  duration: '0.4s'  },
  { id: 'r10', workflowId: 'wf-001', workflowName: 'Welcome Email on New Lead',               status: 'success', recordLabel: 'Priya Sharma — HealthFirst',        recordLink: '/prospects', timestamp: d(6),  duration: '1.1s'  },
]

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
