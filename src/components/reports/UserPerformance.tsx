import { TrendingUp } from 'lucide-react'
import { MOCK_USERS, MOCK_PROSPECTS, MOCK_DEALS } from '@/constants/mockData'

const ROLE_BADGE: Record<string, string> = {
  super_admin:   'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  data_analyst:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  agent:         'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:  'Super Admin',
  data_analyst: 'Data Analyst',
  agent:        'Agent',
}

export function UserPerformance() {
  const rows = MOCK_USERS.map(u => {
    const leads = MOCK_PROSPECTS.filter(p => p.createdby === u.id).length
    const closedDeals = MOCK_DEALS.filter(d => d.assignedTo === u.id && d.stage === 'Closed Won')
    const revenue = closedDeals.reduce((s, d) => s + d.value, 0)
    const activity = Math.floor(20 + leads * 2.5 + closedDeals.length * 5)

    return { user: u, leads, deals: closedDeals.length, revenue, activity }
  })

  const topRevenue = Math.max(...rows.map(r => r.revenue), 1)

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">User Performance</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Activity and results by team member</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['User', 'Role', 'Leads Owned', 'Deals Closed', 'Revenue Generated', 'Activity Score'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user: u, leads, deals, revenue, activity }) => {
              const revPct = (revenue / topRevenue) * 100
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {u.profile_url ? (
                        <img src={u.profile_url} alt={u.first_name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[11px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                          {u.first_name[0]}{u.last_name[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.first_name} {u.last_name}</p>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_BADGE[u.role] ?? ''}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-foreground">{leads}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-foreground">{deals}</td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">${revenue.toLocaleString()}</p>
                      <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${revPct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{activity}</span>
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
