import { useState } from 'react'
import { X, ChevronRight, Plus, Trash2, GripVertical, Zap, GitBranch, Play, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TRIGGER_LABELS, ACTION_LABELS, ACTION_COLORS,
  WORKFLOW_CONDITION_FIELDS, WORKFLOW_OPERATORS,
  WORKFLOW_PRESET_TEMPLATES,
  type TriggerType, type ActionType, type WorkflowCondition, type WorkflowAction, type Workflow,
} from '@/constants/mockWorkflows'

const TRIGGERS: TriggerType[] = ['new_prospect', 'status_changed', 'deal_stage_changed', 'date_based', 'manual']
const ACTIONS:  ActionType[]  = ['send_email', 'create_task', 'update_field', 'notify_user', 'add_segment']

const ACTION_PLACEHOLDER: Record<ActionType, Record<string, string>> = {
  send_email:   { template: 'Introduction Email', delay: '0 minutes' },
  create_task:  { title: '', assignTo: 'Assigned User', dueIn: '1 day' },
  update_field: { field: 'Status', value: '' },
  notify_user:  { message: '', channel: 'In-app' },
  add_segment:  { segment: '' },
}

const ACTION_FIELDS: Record<ActionType, { key: string; label: string; placeholder: string }[]> = {
  send_email:   [{ key: 'template', label: 'Template', placeholder: 'Introduction Email' }, { key: 'delay', label: 'Send After', placeholder: '0 minutes' }],
  create_task:  [{ key: 'title', label: 'Task Title', placeholder: 'Follow up…' }, { key: 'assignTo', label: 'Assign To', placeholder: 'Assigned User' }, { key: 'dueIn', label: 'Due In', placeholder: '1 day' }],
  update_field: [{ key: 'field', label: 'Field', placeholder: 'Status' }, { key: 'value', label: 'New Value', placeholder: '' }],
  notify_user:  [{ key: 'message', label: 'Message', placeholder: 'Notification text…' }, { key: 'channel', label: 'Channel', placeholder: 'In-app' }],
  add_segment:  [{ key: 'segment', label: 'Segment Name', placeholder: 'e.g. Hot Leads' }],
}

type Step = 1 | 2 | 3

interface WorkflowBuilderProps {
  open: boolean
  onClose: () => void
  onSave: (wf: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>) => void
  initial?: Partial<Workflow>
}

export function WorkflowBuilder({ open, onClose, onSave, initial }: WorkflowBuilderProps) {
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [trigger, setTrigger] = useState<TriggerType>(initial?.trigger ?? 'new_prospect')
  const [conditions, setConditions] = useState<WorkflowCondition[]>(initial?.conditions ?? [])
  const [actions, setActions] = useState<WorkflowAction[]>(initial?.actions ?? [])

  if (!open) return null

  // ── Step 1: Trigger ──────────────────────────────────────────
  function addCondition() {
    setConditions(prev => [...prev, { id: `c-${Date.now()}`, field: WORKFLOW_CONDITION_FIELDS[0], operator: 'equals', value: '' }])
  }
  function updateCondition(id: string, key: keyof WorkflowCondition, val: string) {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, [key]: val } : c))
  }
  function removeCondition(id: string) {
    setConditions(prev => prev.filter(c => c.id !== id))
  }

  // ── Step 3: Actions ──────────────────────────────────────────
  function addAction(type: ActionType) {
    setActions(prev => [...prev, { id: `a-${Date.now()}`, type, config: { ...ACTION_PLACEHOLDER[type] } }])
  }
  function updateActionConfig(id: string, key: string, val: string) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, config: { ...a.config, [key]: val } } : a))
  }
  function removeAction(id: string) {
    setActions(prev => prev.filter(a => a.id !== id))
  }
  function moveAction(id: string, dir: -1 | 1) {
    setActions(prev => {
      const idx = prev.findIndex(a => a.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), description, trigger, conditions, actions, status: 'active' })
    onClose()
  }

  function applyTemplate(tpl: typeof WORKFLOW_PRESET_TEMPLATES[number]) {
    setName(tpl.name)
    setDescription(tpl.description)
    setTrigger(tpl.trigger)
    setConditions(tpl.conditions)
    setActions(tpl.actions)
    setStep(3)
  }

  const STEPS = [
    { n: 1 as Step, label: 'Trigger', icon: Zap },
    { n: 2 as Step, label: 'Conditions', icon: GitBranch },
    { n: 3 as Step, label: 'Actions', icon: Play },
  ]

  const selectCls = 'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors'
  const inputCls  = 'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {initial?.id ? 'Edit Workflow' : 'Create Workflow'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Build an automation rule in 3 steps</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-border shrink-0">
          {STEPS.map(({ n, label, icon: Icon }, i) => (
            <div key={n} className="flex items-center">
              <button type="button" onClick={() => setStep(n)}
                className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  step === n ? 'bg-primary text-primary-foreground' : step > n ? 'text-emerald-600 dark:text-emerald-400 hover:bg-accent' : 'text-muted-foreground hover:bg-accent')}>
                {step > n
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <Icon className="h-4 w-4" />}
                {label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Workflow name (always visible) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Workflow Name <span className="text-rose-500">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome New Leads" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this workflow do?" className={inputCls} />
            </div>
          </div>

          {/* ── Step 1: Trigger ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Choose Trigger Event</p>
                <div className="grid grid-cols-1 gap-2">
                  {TRIGGERS.map(t => (
                    <button key={t} type="button" onClick={() => setTrigger(t)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                        trigger === t ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-border hover:bg-accent',
                      )}>
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-base shrink-0',
                        trigger === t ? 'bg-brand-100 dark:bg-brand-900/40' : 'bg-muted')}>
                        {t === 'new_prospect' ? '👤' : t === 'status_changed' ? '🔄' : t === 'deal_stage_changed' ? '📊' : t === 'date_based' ? '📅' : '▶️'}
                      </div>
                      <div>
                        <p className={cn('text-sm font-semibold', trigger === t ? 'text-brand-700 dark:text-brand-300' : 'text-foreground')}>
                          {TRIGGER_LABELS[t]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t === 'new_prospect'       ? 'Fires when a new prospect record is created' :
                           t === 'status_changed'     ? 'Fires when a prospect status field changes' :
                           t === 'deal_stage_changed' ? 'Fires when a deal moves to a different stage' :
                           t === 'date_based'         ? 'Fires on a scheduled date or relative delay' :
                           'Triggered manually by a user'}
                        </p>
                      </div>
                      {trigger === t && <CheckCircle2 className="h-4 w-4 text-brand-500 ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset templates */}
              <div className="space-y-3 border-t border-border pt-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Or Start from a Pre-built Template</p>
                <div className="grid grid-cols-1 gap-2">
                  {WORKFLOW_PRESET_TEMPLATES.map(tpl => (
                    <div key={tpl.name} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-accent transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{tpl.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                      </div>
                      <button type="button" onClick={() => applyTemplate(tpl)}
                        className="shrink-0 h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors">
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Conditions ── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter Conditions (optional)</p>
                <p className="text-xs text-muted-foreground">All conditions must match (AND logic)</p>
              </div>

              {conditions.length === 0 && (
                <div className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
                  No conditions — workflow runs on every trigger
                </div>
              )}

              <div className="space-y-2">
                {conditions.map((cond, i) => (
                  <div key={cond.id} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/20">
                    {i > 0 && <span className="text-xs font-bold text-muted-foreground w-8 text-center shrink-0">AND</span>}
                    {i === 0 && <span className="text-xs font-bold text-muted-foreground w-8 text-center shrink-0">IF</span>}
                    <select value={cond.field} onChange={e => updateCondition(cond.id, 'field', e.target.value)} className={cn(selectCls, 'flex-1')}>
                      {WORKFLOW_CONDITION_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={cond.operator} onChange={e => updateCondition(cond.id, 'operator', e.target.value)} className={cn(selectCls, 'flex-1')}>
                      {WORKFLOW_OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={cond.value} onChange={e => updateCondition(cond.id, 'value', e.target.value)} placeholder="Value…" className={cn(inputCls, 'flex-1')} />
                    <button type="button" onClick={() => removeCondition(cond.id)} aria-label="Remove condition"
                      className="h-8 w-8 shrink-0 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addCondition}
                className="flex items-center gap-2 h-9 px-4 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground hover:border-brand-400 hover:text-brand-600 transition-colors w-full justify-center">
                <Plus className="h-4 w-4" /> Add Condition
              </button>
            </div>
          )}

          {/* ── Step 3: Actions ── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Steps (executed in order)</p>

              {actions.length === 0 && (
                <div className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
                  Add at least one action below
                </div>
              )}

              {/* Action blocks */}
              <div className="space-y-2">
                {actions.map((action, i) => {
                  const fields = ACTION_FIELDS[action.type]
                  const colorCls = ACTION_COLORS[action.type]
                  return (
                    <div key={action.id} className={cn('rounded-xl border p-4 space-y-3', colorCls)}>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5 text-current/40 cursor-grab">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">Step {i + 1}</span>
                        <span className="text-sm font-bold flex-1">{ACTION_LABELS[action.type]}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveAction(action.id, -1)} disabled={i === 0} aria-label="Move up"
                            className="h-6 w-6 rounded flex items-center justify-center opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity text-xs">↑</button>
                          <button type="button" onClick={() => moveAction(action.id, 1)} disabled={i === actions.length - 1} aria-label="Move down"
                            className="h-6 w-6 rounded flex items-center justify-center opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity text-xs">↓</button>
                          <button type="button" onClick={() => removeAction(action.id)} aria-label="Remove action"
                            className="h-6 w-6 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {fields.map(f => (
                          <div key={f.key} className="space-y-1">
                            <label className="text-[11px] font-semibold opacity-70">{f.label}</label>
                            <input
                              value={action.config[f.key] ?? ''}
                              onChange={e => updateActionConfig(action.id, f.key, e.target.value)}
                              placeholder={f.placeholder}
                              className="w-full h-8 rounded-lg border border-current/20 bg-background/60 px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-current/30 transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add action buttons */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Add Action</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map(type => (
                    <button key={type} type="button" onClick={() => addAction(type)}
                      className={cn('flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors hover:opacity-90', ACTION_COLORS[type])}>
                      <Plus className="h-3.5 w-3.5" />{ACTION_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={() => setStep(prev => Math.max(1, prev - 1) as Step)}
            disabled={step === 1}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-40 transition-colors">
            Back
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            {step < 3 ? (
              <button type="button" onClick={() => setStep(prev => (prev + 1) as Step)}
                className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSave} disabled={!name.trim() || actions.length === 0}
                className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Save Workflow
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
