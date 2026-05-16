import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  change: number
  changeLabel?: string
  unit?: string
  trend: 'up' | 'down'
  icon?: LucideIcon
  className?: string
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  unit = '%',
  trend,
  icon: Icon,
  className,
}: MetricCardProps) {
  const isPositive = trend === 'up'

  return (
    <div className={cn('bg-card rounded-xl border border-border p-5 space-y-3 hover:shadow-md transition-shadow', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Icon className="h-4 w-4 text-brand-500" />
          </div>
        )}
      </div>

      <div className="flex items-end gap-3">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold mb-0.5',
            isPositive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
          )}
        >
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{change}{unit}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {changeLabel ?? (isPositive ? `+${Math.abs(change)} vs last week` : `${change} vs last week`)}
      </p>
    </div>
  )
}
