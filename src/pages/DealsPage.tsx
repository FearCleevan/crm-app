import { useState, useCallback, useMemo, useEffect } from 'react'
import { LayoutGrid, List, PlusCircle, TrendingUp, DollarSign, Target, Clock } from 'lucide-react'
import { toast } from 'sonner'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useAuth } from '@/context/AuthContext'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { PipelineBoard, PIPELINE_STAGES } from '@/components/deals/PipelineBoard'
import { DealsList } from '@/components/deals/DealsList'
import { AddDealModal } from '@/components/deals/AddDealModal'
import { DealDetailSheet } from '@/components/deals/DealDetailSheet'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useDeals } from '@/hooks/useDeals'
import { usersService } from '@/services/users.service'
import type { Deal } from '@/constants/mockData'
import type { DealRow, DealInsert, CRMUserRow, DealStage } from '@/types/database'
import { cn } from '@/lib/utils'

type View = 'board' | 'list'

// ── Adapter: DealRow → Deal (UI shape) ───────────────────────
function rowToDeal(row: DealRow): Deal {
  return {
    id: row.id,
    name: row.name,
    prospectId: String(row.prospect_id ?? ''),
    prospectName: row.prospect_name,
    company: row.company,
    stage: row.stage,
    value: Number(row.value),
    probability: row.probability,
    expectedCloseDate: row.expected_close_date,
    assignedTo: row.assigned_to ?? '',
    daysInStage: Math.max(0, Math.floor(
      (Date.now() - new Date(row.stage_changed_at).getTime()) / 86_400_000
    )),
    description: row.description ?? '',
    createdOn: row.created_at,
  }
}

// ── Summary metrics ───────────────────────────────────────────
function SummaryBar({ deals }: { deals: Deal[] }) {
  const pipeline = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
  const won      = deals.filter(d => d.stage === 'Closed Won')
  const closed   = deals.filter(d => d.stage === 'Closed Won' || d.stage === 'Closed Lost')
  const winRate  = closed.length ? Math.round((won.length / closed.length) * 100) : 0
  const avgValue = pipeline.length
    ? Math.round(pipeline.reduce((s, d) => s + d.value, 0) / pipeline.length)
    : 0
  const avgDays  = deals.length
    ? Math.round(deals.reduce((s, d) => s + d.daysInStage, 0) / deals.length)
    : 0

  const stats = [
    { icon: DollarSign, label: 'Total Pipeline',    value: `$${pipeline.reduce((s, d) => s + d.value, 0).toLocaleString()}`, color: 'text-brand-600 dark:text-brand-400'   },
    { icon: TrendingUp, label: 'Avg Deal Size',      value: `$${avgValue.toLocaleString()}`,                                   color: 'text-emerald-600 dark:text-emerald-400' },
    { icon: Target,     label: 'Win Rate',           value: `${winRate}%`,                                                     color: 'text-violet-600 dark:text-violet-400'   },
    { icon: Clock,      label: 'Avg Days to Close',  value: `${avgDays}d`,                                                     color: 'text-amber-600 dark:text-amber-400'     },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 pt-5 pb-4">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className={cn('h-4 w-4', color)} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────
interface Filters { stage: string; assignedTo: string }
const EMPTY_FILTERS: Filters = { stage: '', assignedTo: '' }

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="flex items-center gap-2 px-6 pb-4 flex-wrap">
      <select
        aria-label="Filter by stage"
        value={filters.stage}
        onChange={e => onChange({ ...filters, stage: e.target.value })}
        className="h-8 rounded-lg border border-border bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Stages</option>
        {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {(filters.stage || filters.assignedTo) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-accent transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function DealsPage() {
  const { user } = useAuth()
  const { data: rows, total, loading, create, update, remove, moveStage, reorder } = useDeals()
  const [users, setUsers] = useState<CRMUserRow[]>([])
  const [view, setView]           = useState<View>('board')
  const [addOpen, setAddOpen]     = useState(false)
  const [detailRow, setDetailRow] = useState<DealRow | null>(null)
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [filters, setFilters]     = useState<Filters>(EMPTY_FILTERS)

  // Load users once for assignee display
  useEffect(() => {
    usersService.getUsers().then(r => setUsers(r)).catch(() => {})
  }, [])

  const deals  = useMemo(() => rows.map(rowToDeal), [rows])
  const detail = detailRow ? rowToDeal(detailRow) : null

  const filtered = useMemo(() => deals.filter(d => {
    if (filters.stage && d.stage !== filters.stage) return false
    return true
  }), [deals, filters])

  // ── Add ───────────────────────────────────────────────────
  const handleAdd = useCallback(async (payload: DealInsert) => {
    try {
      await create(payload)
      toast.success('Deal created')
    } catch {
      toast.error('Failed to create deal')
      throw new Error('Failed to create deal')
    }
  }, [create])

  // ── Update ────────────────────────────────────────────────
  const handleUpdate = useCallback(async (id: string, updates: Partial<Deal>) => {
    try {
      const updated = await update(id, {
        stage:               updates.stage as DealStage | undefined,
        value:               updates.value,
        probability:         updates.probability,
        expected_close_date: updates.expectedCloseDate,
        assigned_to:         updates.assignedTo || null,
        description:         updates.description ?? null,
      })
      setDetailRow(updated)
      toast.success('Deal updated')
    } catch {
      toast.error('Failed to update deal')
    }
  }, [update])

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    try {
      await remove(id)
      setDetailRow(null)
      toast.success('Deal deleted')
    } catch {
      toast.error('Failed to delete deal')
    }
  }, [remove])

  // ── Drag and drop ─────────────────────────────────────────
  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return

    const activeId = String(active.id)
    const overId   = String(over.id)
    if (activeId === overId) return

    const targetStage = PIPELINE_STAGES.find(s => s === overId)
    if (targetStage) {
      try {
        await moveStage(activeId, targetStage as DealStage, user?.id)
      } catch {
        toast.error('Failed to move deal')
      }
      return
    }

    const activeDeal = rows.find(d => d.id === activeId)
    const overDeal   = rows.find(d => d.id === overId)
    if (!activeDeal || !overDeal) return

    if (activeDeal.stage !== overDeal.stage) {
      try {
        await moveStage(activeId, overDeal.stage as DealStage, user?.id)
      } catch {
        toast.error('Failed to move deal')
      }
      return
    }

    const stageDeals = rows.filter(d => d.stage === activeDeal.stage)
    const oldIdx = stageDeals.findIndex(d => d.id === activeId)
    const newIdx = stageDeals.findIndex(d => d.id === overId)
    const reordered = arrayMove(stageDeals, oldIdx, newIdx)
    try {
      await reorder(reordered.map(d => d.id))
    } catch {
      toast.error('Failed to reorder deals')
    }
  }

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {loading ? '…' : `${total} deals`}
          </span>
          <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
            <button
              type="button"
              aria-label="Board view"
              onClick={() => setView('board')}
              className={cn('flex items-center gap-1.5 h-8 px-3 text-xs font-medium transition-colors',
                view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setView('list')}
              className={cn('flex items-center gap-1.5 h-8 px-3 text-xs font-medium transition-colors',
                view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        <SummaryBar deals={deals} />
        <FilterBar filters={filters} onChange={setFilters} />

        {/* Add Deal button — mobile */}
        <div className="px-6 pb-3 flex items-center justify-between md:hidden">
          <PermissionGate permission="deals_create">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="h-4 w-4" /> Add Deal
            </button>
          </PermissionGate>
        </div>

        {/* Add Deal button — desktop */}
        <div className="hidden md:flex px-6 pb-3 justify-end">
          <PermissionGate permission="deals_create">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="h-4 w-4" /> Add Deal
            </button>
          </PermissionGate>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading deals…
            </div>
          )}

          {!loading && (
            <>
              {/* Mobile (<768px): always list */}
              <div className="md:hidden h-full">
                <DealsList
                  deals={filtered}
                  users={users}
                  onRowClick={d => {
                    const row = rows.find(r => r.id === d.id)
                    if (row) setDetailRow(row)
                  }}
                  onDelete={handleDelete}
                />
              </div>

              {/* Tablet+ (≥768px): board or list */}
              <div className="hidden md:block h-full overflow-hidden">
                {view === 'board' ? (
                  <div className="h-full overflow-x-auto">
                    <PipelineBoard
                      deals={filtered}
                      users={users}
                      activeId={activeId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onCardClick={d => {
                        const row = rows.find(r => r.id === d.id)
                        if (row) setDetailRow(row)
                      }}
                    />
                  </div>
                ) : (
                  <DealsList
                    deals={filtered}
                    users={users}
                    onRowClick={d => {
                      const row = rows.find(r => r.id === d.id)
                      if (row) setDetailRow(row)
                    }}
                    onDelete={handleDelete}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </PageWrapper>

      <AddDealModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
        userId={user?.id ?? ''}
        users={users}
      />

      {detail && detailRow && (
        <DealDetailSheet
          deal={detail}
          dealId={detailRow.id}
          users={users}
          currentUserId={user?.id ?? ''}
          onClose={() => setDetailRow(null)}
          onUpdate={updates => handleUpdate(detailRow.id, updates)}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}
