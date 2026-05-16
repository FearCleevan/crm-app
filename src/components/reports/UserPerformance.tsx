import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { analyticsService, type UserPerformanceStat } from '@/services/analytics.service'
import type { DateRange } from '@/components/reports/ReportDateRangePicker'

const ROLE_BADGE: Record<string, string> = {
  'Super Admin':  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'Data Analyst': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'Agent':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)    return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

// dateRange prop reserved for future per-period filtering
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Props { dateRange: DateRange }

export function UserPerformance({ dateRange: _ }: Props) {
  const [rows,    setRows]    = useState<UserPerformanceStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsService.getUserPerformanceStats()
      .then(d => { setRows(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const topRevenue = Math.max(...rows.map(r => r.revenue), 1)

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
        <div className="px-5 py-4 border-b border-border h-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-border h-16" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">User Performance</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Activity and results by team member</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">No user data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['User', 'Role', 'Leads Owned', 'Deals Closed', 'Revenue Generated', 'Activities'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(u => {
                const revPct  = (u.revenue / topRevenue) * 100
                const name    = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
                const initials = [u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('')

                return (
                  <tr key={u.user_id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {u.profile_url ? (
                          <img src={u.profile_url} alt={name} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[11px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                            {initials || '?'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_BADGE[u.role] ?? ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-foreground">{u.leads}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-foreground">{u.deals}</td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{fmt(u.revenue)}</p>
                        <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${revPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{u.activities}</span>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
