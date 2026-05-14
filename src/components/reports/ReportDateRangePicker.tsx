import { cn } from '@/lib/utils'

export type DateRange = 'today' | '7d' | '30d' | 'month' | 'quarter' | 'year'

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today:   'Today',
  '7d':    'Last 7 Days',
  '30d':   'Last 30 Days',
  month:   'This Month',
  quarter: 'This Quarter',
  year:    'This Year',
}

const OPTIONS: DateRange[] = ['today', '7d', '30d', 'month', 'quarter', 'year']

interface Props {
  value: DateRange
  onChange: (v: DateRange) => void
}

export function ReportDateRangePicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'h-8 px-3 rounded-lg text-xs font-medium transition-colors border',
            value === opt
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground bg-card',
          )}
        >
          {DATE_RANGE_LABELS[opt]}
        </button>
      ))}
    </div>
  )
}
