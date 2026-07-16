import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, TrendingUp, Clock, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CRMUserRow } from '@/types/database'
import type { Deal } from '@/constants/mockData'
import { CampaignBadge } from './CampaignBadge'

interface DealCardProps {
  deal: Deal
  users: CRMUserRow[]
  onClick: (deal: Deal) => void
  overlay?: boolean
}

export function DealCard({ deal, users, onClick, overlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const assignee = users.find(u => u.id === deal.assignedTo)

  const probabilityColor =
    deal.probability >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
    deal.probability >= 50 ? 'text-amber-600 dark:text-amber-400' :
    'text-rose-600 dark:text-rose-400'

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onClick(deal)}
      className={cn(
        'group bg-card border border-border rounded-xl p-3.5 shadow-sm cursor-pointer transition-all select-none',
        'hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md hover:scale-[1.01]',
        isDragging && 'opacity-40',
        overlay && 'shadow-2xl rotate-1 scale-[1.02]',
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Drag deal"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Deal name */}
          <p className="text-sm font-semibold text-foreground leading-snug truncate">{deal.name}</p>
          <p className="text-xs text-muted-foreground truncate">{deal.company}</p>

          {/* Value */}
          <p className="text-base font-bold text-foreground">${deal.value.toLocaleString()}</p>

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn('flex items-center gap-1 text-xs font-medium', probabilityColor)}>
              <TrendingUp className="h-3 w-3" />
              {deal.probability}%
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {deal.daysInStage}d
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(deal.expectedCloseDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </span>
          </div>

          {/* Assignee */}
          {assignee && (
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                {assignee.first_name?.[0]}{assignee.last_name?.[0]}
              </div>
              <span className="text-xs text-muted-foreground truncate">{assignee.first_name} {assignee.last_name}</span>
            </div>
          )}

          {/* Campaign badge */}
          {deal.sourceCampaignName && <CampaignBadge campaignName={deal.sourceCampaignName} />}
        </div>
      </div>
    </div>
  )
}
