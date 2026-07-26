import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { SegmentPoint } from '@/services/analytics.service'

const COLORS = {
  smes:       '#0c7c8d',
  midmarket:  'hsl(160,84%,39%)',
  enterprise: 'hsl(215,16%,47%)',
}

const LABELS = { smes: 'SMEs', midmarket: 'Mid-Market', enterprise: 'Enterprise' }

interface LegendPayload { color: string; value: string }

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

interface Props {
  segments?: SegmentPoint[]
}

export function RetentionChart({ segments = [] }: Props) {
  const total    = segments.reduce((s, m) => s + m.smes + m.midmarket + m.enterprise, 0)
  const lastMonth = segments[segments.length - 1]
  const lastTotal = lastMonth ? lastMonth.smes + lastMonth.midmarket + lastMonth.enterprise : 0

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">New Prospects by Segment</p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-2xl font-bold text-foreground">{total.toLocaleString()}</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 mb-0.5">
              {lastTotal} last month
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-44">
        {segments.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No segment data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={segments} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barSize={6} barGap={2}>
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
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid hsl(214,32%,91%)',
                  backgroundColor: 'hsl(0,0%,100%)',
                  fontSize: '12px',
                }}
              />
              <Legend content={<CustomLegend />} formatter={v => LABELS[v as keyof typeof LABELS] ?? v} />
              <Bar dataKey="smes"       name={LABELS.smes}       fill={COLORS.smes}       radius={[3, 3, 0, 0]} />
              <Bar dataKey="midmarket"  name={LABELS.midmarket}  fill={COLORS.midmarket}  radius={[3, 3, 0, 0]} />
              <Bar dataKey="enterprise" name={LABELS.enterprise} fill={COLORS.enterprise} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
