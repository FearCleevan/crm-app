import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { MOCK_REVENUE_DATA } from '@/constants/mockData'
import { cn } from '@/lib/utils'

const FILTERS = ['1D', '1W', '1M', '6M', '1Y', 'ALL'] as const
type Filter = typeof FILTERS[number]

const SLICE_MAP: Record<Filter, number> = {
  '1D':  1,
  '1W':  7,
  '1M':  3,
  '6M':  6,
  '1Y':  12,
  'ALL': MOCK_REVENUE_DATA.length,
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

interface TooltipPayload {
  value: number
  payload: { month: string }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const { month, value } = { month: payload[0].payload.month, value: payload[0].value }
  return (
    <div className="rounded-xl border border-border bg-card shadow-lg px-4 py-3 text-sm">
      <p className="text-muted-foreground mb-1">{month}</p>
      <p className="font-bold text-foreground text-base">{formatCurrency(value)}</p>
    </div>
  )
}

export function RevenueChart() {
  const [activeFilter, setActiveFilter] = useState<Filter>('1Y')

  const data = useMemo(() => {
    const count = SLICE_MAP[activeFilter]
    return MOCK_REVENUE_DATA.slice(-count)
  }, [activeFilter])

  const latest = data[data.length - 1]?.value ?? 0
  const prev   = data[data.length - 2]?.value ?? latest
  const pctChange = prev > 0 ? ((latest - prev) / prev * 100).toFixed(0) : '0'
  const isUp = latest >= prev

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Revenue</p>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-foreground">{formatCurrency(latest)}</p>
            <span className={cn(
              'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold mb-1',
              isUp
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
            )}>
              {isUp ? '+' : ''}{pctChange}% vs last month
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                activeFilter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="hsl(245,58%,51%)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(245,58%,51%)" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,32%,91%)" strokeOpacity={0.6} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(215,16%,47%)' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(215,16%,47%)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(245,58%,51%)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(245,58%,51%)"
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{ r: 5, fill: 'hsl(245,58%,51%)', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
