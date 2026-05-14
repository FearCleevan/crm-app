import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { MOCK_PROSPECTS, MOCK_USERS, DISPOSITION_CODES, PROVIDERS } from '@/constants/mockData'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']

export function LeadsReport() {
  // Leads by provider
  const byProvider = PROVIDERS.map(p => ({
    name: p.name,
    count: MOCK_PROSPECTS.filter(pr => pr.providercode === p.code).length,
  })).filter(p => p.count > 0)

  // Disposition breakdown
  const byDisposition = DISPOSITION_CODES.map(d => ({
    name: d.name,
    value: MOCK_PROSPECTS.filter(pr => pr.dispositioncode === d.code).length,
  })).filter(d => d.value > 0)

  // Leads by assigned user (using createdby as proxy)
  const byUser = MOCK_USERS.slice(0, 5).map(u => ({
    name: `${u.first_name} ${u.last_name}`,
    role: u.role,
    leads: MOCK_PROSPECTS.filter(p => p.createdby === u.id).length,
    contacted: MOCK_PROSPECTS.filter(p => p.createdby === u.id && p.status === 'Contacted').length,
    qualified: MOCK_PROSPECTS.filter(p => p.createdby === u.id && p.status === 'Qualified').length,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar: leads by source */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Leads by Source / Provider</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byProvider} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
              />
              <Bar dataKey="count" name="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie: disposition breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Disposition Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byDisposition} dataKey="value" nameKey="name" cx="45%" cy="50%" outerRadius={80} paddingAngle={2}>
                {byDisposition.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: leads by user */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Leads by Assigned User</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['User', 'Role', 'Total Leads', 'Contacted', 'Qualified', 'Conv. Rate'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byUser.map(u => (
                <tr key={u.name} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{u.name}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground capitalize">{u.role.replace('_', ' ')}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-foreground">{u.leads}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{u.contacted}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{u.qualified}</td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {u.leads ? `${Math.round((u.qualified / u.leads) * 100)}%` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
