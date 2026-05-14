import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { MOCK_REVENUE_DATA } from '@/constants/mockData'
import { cn } from '@/lib/utils'

type Period = 'monthly' | 'quarterly' | 'annual'

const QUARTERLY = [
  { month: 'Q2 FY25', value: 60200 },
  { month: 'Q3 FY25', value: 83700 },
  { month: 'Q4 FY25', value: 101600 },
  { month: 'Q1 FY26', value: 109209 },
]

const ANNUAL = [
  { month: 'FY24', value: 284000 },
  { month: 'FY25', value: 323100 },
  { month: 'FY26 (YTD)', value: 109209 },
]

function fmt(v: number) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000)    return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

export function RevenueOverTime() {
  const [period, setPeriod] = useState<Period>('monthly')

  const data =
    period === 'monthly'   ? MOCK_REVENUE_DATA :
    period === 'quarterly' ? QUARTERLY : ANNUAL

  const total = data.reduce((s, d) => s + d.value, 0)
  const last = data[data.length - 1].value
  const prev = data[data.length - 2]?.value ?? last
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Latest</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{fmt(last)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Growth</p>
          <p className={cn('text-xl font-bold mt-0.5', growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
            {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Period Total</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{fmt(total)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={fmt} />
          <Tooltip
            formatter={v => [fmt(v as number), 'Revenue']}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
