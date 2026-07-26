import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { analyticsService, type LeadsReportData } from '@/services/analytics.service'
import { DISPOSITION_CODES, PROVIDERS } from '@/constants/mockData'
import type { DateRange } from '@/components/reports/ReportDateRangePicker'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']

interface Props { dateRange: DateRange }

export function LeadsReport({ dateRange }: Props) {
  const [data,    setData]    = useState<LeadsReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsService.getLeadsReportData(dateRange)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dateRange])

  const byProvider = useMemo(() =>
    (data?.by_provider ?? []).map(r => ({
      name:  PROVIDERS.find(p => p.code === r.code)?.name ?? r.code,
      count: r.count,
    })),
    [data]
  )

  const byDisposition = useMemo(() =>
    (data?.by_disposition ?? []).map(r => ({
      name:  DISPOSITION_CODES.find(d => d.code === r.code)?.name ?? r.code,
      value: r.count,
    })),
    [data]
  )

  const byUser = data?.by_user ?? []

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5 h-64" />
          <div className="bg-card border border-border rounded-xl p-5 h-64" />
        </div>
        <div className="bg-card border border-border rounded-xl h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar: leads by source */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Leads by Source / Provider</h3>
          {byProvider.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byProvider} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'rgba(12, 124, 141, 0.08)' }}
                />
                <Bar dataKey="count" name="Leads" fill="#0c7c8d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie: disposition breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Disposition Breakdown</h3>
          {byDisposition.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data for this period</div>
          ) : (
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
          )}
        </div>
      </div>

      {/* Table: leads by user */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Leads by Assigned User</h3>
        </div>
        {byUser.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No data for this period</div>
        ) : (
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
                  <tr key={u.user_id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{u.name.trim() || u.email}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground capitalize">{u.role.replace(/_/g, ' ')}</td>
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
        )}
      </div>
    </div>
  )
}
