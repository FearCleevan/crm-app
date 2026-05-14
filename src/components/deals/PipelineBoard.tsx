import { useMemo } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { DealCard } from './DealCard'
import type { Deal } from '@/constants/mockData'

export const PIPELINE_STAGES: Deal['stage'][] = [
  'New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost',
]

const STAGE_COLORS: Record<Deal['stage'], string> = {
  'New Lead':      'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
  'Contacted':     'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  'Qualified':     'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800',
  'Proposal Sent': 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
  'Negotiation':   'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
  'Closed Won':    'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
  'Closed Lost':   'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800',
}

const STAGE_HEADER_COLORS: Record<Deal['stage'], string> = {
  'New Lead':      'text-slate-600 dark:text-slate-300',
  'Contacted':     'text-blue-600 dark:text-blue-400',
  'Qualified':     'text-violet-600 dark:text-violet-400',
  'Proposal Sent': 'text-amber-600 dark:text-amber-400',
  'Negotiation':   'text-orange-600 dark:text-orange-400',
  'Closed Won':    'text-emerald-600 dark:text-emerald-400',
  'Closed Lost':   'text-rose-600 dark:text-rose-400',
}

const STAGE_DOT: Record<Deal['stage'], string> = {
  'New Lead':      'bg-slate-400',
  'Contacted':     'bg-blue-500',
  'Qualified':     'bg-violet-500',
  'Proposal Sent': 'bg-amber-500',
  'Negotiation':   'bg-orange-500',
  'Closed Won':    'bg-emerald-500',
  'Closed Lost':   'bg-rose-500',
}

interface PipelineBoardProps {
  deals: Deal[]
  activeId: string | null
  onDragStart: (e: DragStartEvent) => void
  onDragEnd: (e: DragEndEvent) => void
  onCardClick: (deal: Deal) => void
}

export function PipelineBoard({ deals, activeId, onDragStart, onDragEnd, onCardClick }: PipelineBoardProps) {
  const byStage = useMemo(() => {
    const map: Record<string, Deal[]> = {}
    PIPELINE_STAGES.forEach(s => { map[s] = [] })
    deals.forEach(d => { if (map[d.stage]) map[d.stage].push(d) })
    return map
  }, [deals])

  const activeCard = activeId ? deals.find(d => d.id === activeId) : null

  return (
    <DndContext collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 h-full min-w-max px-6 pb-6 pt-4">
        {PIPELINE_STAGES.map(stage => {
          const stageDeals = byStage[stage] ?? []
          const totalValue = stageDeals.reduce((s, d) => s + d.value, 0)

          return (
            <div key={stage} className={cn('flex flex-col w-64 shrink-0 rounded-xl border', STAGE_COLORS[stage])}>
              {/* Column header */}
              <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', STAGE_DOT[stage])} />
                  <span className={cn('text-xs font-bold uppercase tracking-wide truncate', STAGE_HEADER_COLORS[stage])}>
                    {stage}
                  </span>
                  <span className="ml-auto h-5 min-w-5 rounded-full bg-background/70 dark:bg-background/40 text-[10px] font-semibold text-foreground px-1.5 flex items-center justify-center border border-border/50">
                    {stageDeals.length}
                  </span>
                </div>
                {totalValue > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 pl-4">${totalValue.toLocaleString()}</p>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[60px]">
                <SortableContext items={stageDeals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                  {stageDeals.map(deal => (
                    <DealCard key={deal.id} deal={deal} onClick={onCardClick} />
                  ))}
                </SortableContext>
                {stageDeals.length === 0 && (
                  <div className="h-16 flex items-center justify-center rounded-lg border-2 border-dashed border-border/50">
                    <p className="text-xs text-muted-foreground/60">Drop here</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeCard && <DealCard deal={activeCard} onClick={() => {}} overlay />}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
