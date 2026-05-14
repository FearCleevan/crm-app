import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { MOCK_RETENTION_DATA } from '@/constants/mockData'

const COLORS = {
  SMEs:        'hsl(245,58%,51%)',
  Startups:    'hsl(160,84%,39%)',
  Enterprises: 'hsl(215,16%,47%)',
}

interface LegendPayload {
  color: string
  value: string
}

function CustomLegend({ payload }: { payload?: LegendPayload[] }) {
  if (!payload) return null
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {payload.map(p => (
        <div key={p.value} className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-muted-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function RetentionChart() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Retention Rate</p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold text-foreground">95%</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 mb-0.5">
              +12% vs last month
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MOCK_RETENTION_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barSize={6} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,32%,91%)" strokeOpacity={0.6} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }}
              axisLine={false}
              tickLine={false}
              dy={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '10px',
                border: '1px solid hsl(214,32%,91%)',
                backgroundColor: 'hsl(0,0%,100%)',
                fontSize: '12px',
              }}
              formatter={(v) => [`${v}%`]}
            />
            <Legend content={<CustomLegend />} />
            <Bar dataKey="SMEs"        fill={COLORS.SMEs}        radius={[3, 3, 0, 0]} />
            <Bar dataKey="Startups"    fill={COLORS.Startups}    radius={[3, 3, 0, 0]} />
            <Bar dataKey="Enterprises" fill={COLORS.Enterprises} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
