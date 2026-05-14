import { MOCK_PROSPECTS, MOCK_DEALS } from '@/constants/mockData'

interface FunnelStep {
  label: string
  count: number
  color: string
  pct?: number
}

export function ConversionFunnel() {
  const total      = MOCK_PROSPECTS.length
  const contacted  = MOCK_PROSPECTS.filter(p => ['Contacted','Qualified','Closed'].includes(p.status)).length
  const qualified  = MOCK_PROSPECTS.filter(p => ['Qualified','Closed'].includes(p.status)).length
  const proposals  = MOCK_DEALS.filter(d => ['Proposal Sent','Negotiation','Closed Won'].includes(d.stage)).length
  const won        = MOCK_DEALS.filter(d => d.stage === 'Closed Won').length

  const steps: FunnelStep[] = [
    { label: 'Total Leads',    count: total,     color: 'bg-slate-500 dark:bg-slate-400' },
    { label: 'Contacted',      count: contacted, color: 'bg-blue-500' },
    { label: 'Qualified',      count: qualified, color: 'bg-violet-500' },
    { label: 'Proposal Sent',  count: proposals, color: 'bg-amber-500' },
    { label: 'Closed Won',     count: won,        color: 'bg-emerald-500' },
  ]

  const maxCount = steps[0].count || 1

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Conversion Funnel</h3>
        <p className="text-xs text-muted-foreground">Lead-to-close pipeline progression</p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const widthPct = (step.count / maxCount) * 100
          const convPct  = i === 0 ? 100 : Math.round((step.count / steps[i - 1].count) * 100) || 0
          const totalPct = Math.round((step.count / maxCount) * 100)

          return (
            <div key={step.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{step.label}</span>
                  {i > 0 && (
                    <span className="text-muted-foreground">
                      ↓ {convPct}% from prev
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{step.count.toLocaleString()}</span>
                  <span className="text-muted-foreground w-10 text-right">{totalPct}%</span>
                </div>
              </div>
              <div className="h-9 bg-muted rounded-lg overflow-hidden flex items-center">
                <div
                  className={`h-full ${step.color} rounded-lg transition-all duration-500 flex items-center px-3`}
                  style={{ width: `${widthPct}%`, minWidth: step.count > 0 ? '2rem' : '0' }}
                >
                  {widthPct > 15 && (
                    <span className="text-white text-xs font-bold">{step.count}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {total ? `${Math.round((won / total) * 100)}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Lead → Win Rate</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {contacted ? `${Math.round((qualified / contacted) * 100)}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Qualification Rate</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {proposals ? `${Math.round((won / proposals) * 100)}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Proposal Win Rate</p>
        </div>
      </div>
    </div>
  )
}
