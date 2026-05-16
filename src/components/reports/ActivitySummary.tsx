import { useState, useEffect, useMemo } from 'react'
import { PhoneCall, Mail, MessageSquare, Video } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { analyticsService, type ActivityBreakdown } from '@/services/analytics.service'
import type { DateRange } from '@/components/reports/ReportDateRangePicker'

const ALL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props { dateRange: DateRange }

export function ActivitySummary({ dateRange }: Props) {
  const [data,    setData]    = useState<ActivityBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsService.getActivityBreakdown(dateRange)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dateRange])

  // Merge RPC by_day data into a full 7-day array so the chart always shows all days
  const byDay = useMemo(() => {
    const rpcDays = data?.by_day ?? []
    return ALL_DAYS.map((day, dow) => {
      const found = rpcDays.find(d => d.dow === dow)
      return { day, calls: found?.calls ?? 0, emails: found?.emails ?? 0, notes: found?.notes ?? 0, tasks: found?.tasks ?? 0 }
    })
  }, [data])

  const totalCalls    = data?.total_calls    ?? 0
  const totalEmails   = data?.total_emails   ?? 0
  const totalNotes    = data?.total_notes    ?? 0
  const totalMeetings = data?.total_meetings ?? 0

  const metricCards = [
    { icon: PhoneCall,     label: 'Total Calls',     value: totalCalls,    color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/30'     },
    { icon: Mail,          label: 'Emails Logged',   value: totalEmails,   color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
    { icon: MessageSquare, label: 'Notes Logged',    value: totalNotes,    color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/20'   },
    { icon: Video,         label: 'Meetings Logged', value: totalMeetings, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
  ]

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-card border border-border rounded-xl h-24" />)}
        </div>
        <div className="bg-card border border-border rounded-xl h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity by day of week */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Activity by Day of Week</h3>
        {(totalCalls + totalEmails + totalNotes + totalMeetings) === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">No activity logged for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDay} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{v}</span>} />
              <Bar dataKey="calls"  name="Calls"    fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="emails" name="Emails"   fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="notes"  name="Notes"    fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="tasks"  name="Meetings" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
