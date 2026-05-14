import { useState } from 'react'
import { cn } from '@/lib/utils'

const TABS = ['Status', 'Sources', 'Qualification'] as const
type Tab = typeof TABS[number]

const STATUS_DATA = [
  { label: 'Open',        value: 114, color: 'bg-brand-500',   textColor: 'text-brand-600 dark:text-brand-400',   pct: 44 },
  { label: 'In Progress', value: 62,  color: 'bg-amber-400',   textColor: 'text-amber-600 dark:text-amber-400',   pct: 24 },
  { label: 'Lost',        value: 47,  color: 'bg-rose-400',    textColor: 'text-rose-600 dark:text-rose-400',     pct: 18 },
  { label: 'Won',         value: 38,  color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', pct: 14 },
]

const SOURCES_DATA = [
  { label: 'Apollo',     value: 89,  pct: 34, color: 'bg-brand-500'   },
  { label: 'ZoomInfo',   value: 62,  pct: 24, color: 'bg-violet-500'  },
  { label: 'LinkedIn',   value: 54,  pct: 21, color: 'bg-blue-500'    },
  { label: 'Hunter.io',  value: 37,  pct: 14, color: 'bg-amber-400'   },
  { label: 'Manual',     value: 19,  pct: 7,  color: 'bg-slate-400'   },
]

const QUAL_DATA = [
  { label: 'Hot Lead',     value: 42, pct: 32, color: 'bg-rose-500'    },
  { label: 'Warm Lead',    value: 71, pct: 55, color: 'bg-amber-400'   },
  { label: 'Cold Lead',    value: 28, pct: 22, color: 'bg-brand-500'   },
  { label: 'Unqualified',  value: 20, pct: 15, color: 'bg-slate-400'   },
]

function BarRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-semibold text-foreground">{value} <span className="text-muted-foreground font-normal">leads</span></span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function LeadsManagementCard() {
  const [tab, setTab] = useState<Tab>('Status')

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Leads Management</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 rounded-md text-xs font-medium transition-all',
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Status: 2×2 grid */}
      {tab === 'Status' && (
        <div className="grid grid-cols-2 gap-3">
          {STATUS_DATA.map(s => (
            <div key={s.label} className="rounded-lg border border-border p-3 space-y-2">
              <div className={cn('h-1 w-8 rounded-full', s.color)} />
              <p className={cn('text-xl font-bold', s.textColor)}>{s.value}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xs font-medium text-muted-foreground">{s.pct}%</p>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sources: bar rows */}
      {tab === 'Sources' && (
        <div className="space-y-3">
          {SOURCES_DATA.map(s => <BarRow key={s.label} {...s} />)}
        </div>
      )}

      {/* Qualification: bar rows */}
      {tab === 'Qualification' && (
        <div className="space-y-3">
          {QUAL_DATA.map(s => <BarRow key={s.label} {...s} />)}
        </div>
      )}
    </div>
  )
}
