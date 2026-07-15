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

export function WorkflowsPage() {
  const { user } = useAuth()
  const { workflows, runs, loading, add, update, toggle, duplicate, remove } = useWorkflowsState(user?.id ?? '')
  const [tab, setTab] = useState<Tab>('workflows')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')

  const filtered = useMemo(() => workflows.filter(w => {
    if (statusFilter !== 'all' && w.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)
    }
    return true
  }), [workflows, search, statusFilter])

  const activeCount = workflows.filter(w => w.status === 'active').length
  const totalRuns   = workflows.reduce((s, w) => s + w.runCount, 0)

  function handleEdit(wf: Workflow) {
    setEditing(wf)
    setBuilderOpen(true)
  }

  function handleSave(data: Omit<Workflow, 'id' | 'runCount' | 'lastRun' | 'createdOn'>) {
    if (editing) {
      update(editing.id, data)
      setEditing(null)
    } else {
      add(data)
    }
    setBuilderOpen(false)
  }

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <PermissionGate permission="workflows_manage">
            <button type="button" onClick={() => { setEditing(null); setBuilderOpen(true) }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="h-3.5 w-3.5" /> New Workflow
            </button>
          </PermissionGate>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Summary bar */}
        <div className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Workflows & Automations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Automate repetitive tasks and follow-ups</p>
            </div>
            <PermissionGate permission="workflows_manage">
              <button type="button" onClick={() => { setEditing(null); setBuilderOpen(true) }}
                className="md:hidden flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="h-3.5 w-3.5" /> New Workflow
              </button>
            </PermissionGate>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Zap,      label: 'Total Workflows', value: workflows.length, color: 'text-brand-600 dark:text-brand-400',    bg: 'bg-brand-50 dark:bg-brand-900/20' },
              { icon: Play,     label: 'Active',          value: activeCount,       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
              { icon: BarChart2,label: 'Total Runs',      value: totalRuns.toLocaleString(), color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/20' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
                  <p className="text-lg font-bold text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs + filters */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card shrink-0 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-lg border border-border overflow-hidden">
            {(['workflows', 'log'] as Tab[]).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={cn('h-8 px-4 text-xs font-medium transition-colors capitalize',
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
                {t === 'log' ? 'Run Log' : 'All Workflows'}
              </button>
            ))}
          </div>

          {tab === 'workflows' && (
            <>
              {/* Search */}
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows…"
                  className="w-full h-8 pl-8 pr-7 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                {search && (
                  <button type="button" aria-label="Clear search" onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1">
                {(['all', 'active', 'paused'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setStatusFilter(s)}
                    className={cn('h-8 px-3 rounded-lg text-xs font-medium transition-colors border capitalize',
                      statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent bg-card')}>
                    {s === 'all' ? 'All' : s === 'active' ? `Active (${activeCount})` : `Paused (${workflows.length - activeCount})`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'workflows' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading workflows…</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                  <Zap className="h-10 w-10 opacity-20" />
                  <p className="font-medium">No workflows found</p>
                  <p className="text-sm">Create your first automation to get started</p>
                  <PermissionGate permission="workflows_manage">
                    <button type="button" onClick={() => { setEditing(null); setBuilderOpen(true) }}
                      className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors mt-1">
                      <Plus className="h-4 w-4" /> Create Workflow
                    </button>
                  </PermissionGate>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(wf => (
                    <WorkflowCard
                      key={wf.id}
                      workflow={wf}
                      onToggle={toggle}
                      onEdit={handleEdit}
                      onDuplicate={duplicate}
                      onDelete={remove}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'log' && <WorkflowLog runs={runs} loading={loading} />}
        </div>
      </PageWrapper>

      <WorkflowBuilder
        key={editing?.id ?? 'new'}
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditing(null) }}
        onSave={handleSave}
        initial={editing ?? undefined}
      />
    </>
  )
}
