import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { LeadsBreakdown } from '@/services/analytics.service'
import { DISPOSITION_CODES, PROVIDERS } from '@/constants/mockData'

const TABS = ['Status', 'Sources', 'Qualification'] as const
type Tab = typeof TABS[number]

// Prospect status → display config
const STATUS_CONFIG: Record<string, { label: string; color: string; textColor: string }> = {
  New:       { label: 'Open',        color: 'bg-brand-500',   textColor: 'text-brand-600 dark:text-brand-400'     },
  Contacted: { label: 'In Progress', color: 'bg-amber-400',   textColor: 'text-amber-600 dark:text-amber-400'     },
  Closed:    { label: 'Lost',        color: 'bg-rose-400',    textColor: 'text-rose-600 dark:text-rose-400'       },
  Qualified: { label: 'Won',         color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
}

const SOURCE_COLORS = ['bg-brand-500', 'bg-violet-500', 'bg-blue-500', 'bg-amber-400', 'bg-slate-400']
const DISP_COLORS   = ['bg-rose-500', 'bg-amber-400', 'bg-brand-500', 'bg-slate-400', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500']

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

interface Props {
  breakdown?: LeadsBreakdown
}

export function LeadsManagementCard({ breakdown }: Props) {
  const [tab, setTab] = useState<Tab>('Status')

  const statusData = useMemo(() => {
    const rows = breakdown?.by_status ?? []
    const total = rows.reduce((s, r) => s + r.count, 0) || 1
    return rows.map(r => {
      const cfg = STATUS_CONFIG[r.status] ?? { label: r.status, color: 'bg-slate-400', textColor: 'text-muted-foreground' }
      return { ...cfg, value: r.count, pct: Math.round((r.count / total) * 100) }
    })
  }, [breakdown])

  const sourcesData = useMemo(() => {
    const rows = breakdown?.by_provider ?? []
    const max  = rows[0]?.count || 1
    return rows.map((r, i) => {
      const prov = PROVIDERS.find(p => p.code === r.code)
      return {
        label: prov?.name ?? r.code,
        value: r.count,
        pct:   Math.round((r.count / max) * 100),
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
      }
    })
  }, [breakdown])

  const qualData = useMemo(() => {
    const rows = breakdown?.by_disposition ?? []
    const max  = rows[0]?.count || 1
    return rows.map((r, i) => {
      const disp = DISPOSITION_CODES.find(d => d.code === r.code)
      return {
        label: disp?.name ?? r.code,
        value: r.count,
        pct:   Math.round((r.count / max) * 100),
        color: DISP_COLORS[i % DISP_COLORS.length],
      }
    })
  }, [breakdown])

  const isEmpty = !breakdown

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
            type="button"
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

      {isEmpty && (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      )}

      {/* Status: 2×2 grid */}
      {!isEmpty && tab === 'Status' && (
        statusData.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {statusData.map(s => (
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
        )
      )}

      {/* Sources: bar rows */}
      {!isEmpty && tab === 'Sources' && (
        sourcesData.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="space-y-3">
            {sourcesData.map(s => <BarRow key={s.label} {...s} />)}
          </div>
        )
      )}

      {/* Qualification: bar rows */}
      {!isEmpty && tab === 'Qualification' && (
        qualData.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="space-y-3">
            {qualData.map(s => <BarRow key={s.label} {...s} />)}
          </div>
        )
      )}
    </div>
  )
}
