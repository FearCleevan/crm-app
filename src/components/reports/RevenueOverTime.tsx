import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { analyticsService, type RevenuePoint } from '@/services/analytics.service'
import type { DateRange } from '@/components/reports/ReportDateRangePicker'
import { cn } from '@/lib/utils'

type Period = 'monthly' | 'quarterly' | 'annual'

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)    return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

function toQuarterly(monthly: RevenuePoint[]): RevenuePoint[] {
  const map = new Map<string, number>()
  monthly.forEach(d => {
    const [mon, yr] = d.month.split(' ')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const mIdx   = months.indexOf(mon)
    if (mIdx < 0) return
    const q   = Math.floor(mIdx / 3) + 1
    const key = `Q${q} '${yr}`
    map.set(key, (map.get(key) ?? 0) + d.value)
  })
  return Array.from(map.entries()).map(([month, value]) => ({ month, value }))
}

function toAnnual(monthly: RevenuePoint[]): RevenuePoint[] {
  const map = new Map<string, number>()
  monthly.forEach(d => {
    const yr  = d.month.split(' ')[1] ?? ''
    const key = `FY${yr}`
    map.set(key, (map.get(key) ?? 0) + d.value)
  })
  return Array.from(map.entries()).map(([month, value]) => ({ month, value }))
}

interface Props { dateRange: DateRange }

export function RevenueOverTime({ dateRange }: Props) {
  const [period,  setPeriod]  = useState<Period>('monthly')
  const [monthly, setMonthly] = useState<RevenuePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsService.getRevenueByMonth(24)
      .then(d => { setMonthly(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // dateRange filters the monthly data for the monthly view
  const filtered = useMemo(() => {
    if (period !== 'monthly') return monthly
    // filter by dateRange cutoff (reuse the same helper logic inline)
    const now = new Date()
    let cutoff: Date
    switch (dateRange) {
      case 'today':   cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
      case '7d':      cutoff = new Date(Date.now() - 7 * 86_400_000); break
      case '30d':     cutoff = new Date(Date.now() - 30 * 86_400_000); break
      case 'month':   cutoff = new Date(now.getFullYear(), now.getMonth(), 1); break
      case 'quarter': cutoff = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break
      case 'year':    cutoff = new Date(now.getFullYear(), 0, 1); break
    }
    // monthly data is ordered oldest→newest, so slice from index where the month fits
    const cutMonth = cutoff.getFullYear() * 12 + cutoff.getMonth()
    const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return monthly.filter(d => {
      const [mon, yr] = d.month.split(' ')
      const fullYr    = 2000 + parseInt(yr ?? '0', 10)
      const mIdx      = months.indexOf(mon)
      return fullYr * 12 + mIdx >= cutMonth
    })
  }, [monthly, period, dateRange])

  const data = useMemo(() => {
    if (period === 'quarterly') return toQuarterly(monthly)
    if (period === 'annual')    return toAnnual(monthly)
    return filtered
  }, [period, monthly, filtered])

  const total  = data.reduce((s, d) => s + d.value, 0)
  const last   = data[data.length - 1]?.value ?? 0
  const prev   = data[data.length - 2]?.value ?? last
  const growth = prev ? ((last - prev) / prev) * 100 : 0

  const PERIODS: { id: Period; label: string }[] = [
    { id: 'monthly',   label: 'Monthly'   },
    { id: 'quarterly', label: 'Quarterly' },
    { id: 'annual',    label: 'Annual'    },
  ]

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Revenue Over Time</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Total period: {fmt(total)}</p>
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map(p => (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
              className={cn('h-7 px-3 rounded-lg text-xs font-medium transition-colors border',
                period === p.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent bg-card')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Latest</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{loading ? '…' : fmt(last)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Growth</p>
          <p className={cn('text-xl font-bold mt-0.5', growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
            {loading ? '…' : `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Period Total</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{loading ? '…' : fmt(total)}</p>
        </div>
      </div>

      {loading ? (
        <div className="h-[240px] bg-muted rounded-xl animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No revenue data for this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0c7c8d" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0c7c8d" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={fmt} />
            <Tooltip
              formatter={v => [fmt(v as number), 'Revenue']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="value" stroke="#0c7c8d" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
