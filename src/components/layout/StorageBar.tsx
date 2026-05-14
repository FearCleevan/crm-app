import { cn } from '@/lib/utils'

interface StorageBarProps {
  used: number
  total: number
  unit?: string
  className?: string
}

export function StorageBar({ used, total, unit = 'GB', className }: StorageBarProps) {
  const pct = Math.min(Math.round((used / total) * 100), 100)
  const isWarning = pct >= 80

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-sidebar-foreground">Cloud Storage</span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isWarning ? 'bg-orange-500' : 'bg-brand-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {used} {unit} of {total} {unit} used
      </p>
      <button className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1 transition-colors">
        Upgrade Storage
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] text-white font-bold">i</span>
      </button>
    </div>
  )
}
