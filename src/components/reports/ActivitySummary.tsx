import { PhoneCall, Mail, MessageSquare, CheckCircle2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const ACTIVITY_BY_DAY = [
  { day: 'Mon', calls: 18, emails: 24, notes: 9,  tasks: 12 },
  { day: 'Tue', calls: 22, emails: 31, notes: 14, tasks: 18 },
  { day: 'Wed', calls: 15, emails: 28, notes: 11, tasks: 9  },
  { day: 'Thu', calls: 27, emails: 35, notes: 16, tasks: 21 },
  { day: 'Fri', calls: 20, emails: 22, notes: 8,  tasks: 15 },
  { day: 'Sat', calls: 4,  emails: 6,  notes: 2,  tasks: 3  },
  { day: 'Sun', calls: 2,  emails: 3,  notes: 1,  tasks: 1  },
]

const METRIC_CARDS = [
  { icon: PhoneCall,     label: 'Total Calls',    value: 108,  sub: '+12% vs last period', color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { icon: Mail,          label: 'Emails Sent',    value: 149,  sub: '+8% vs last period',  color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  { icon: MessageSquare, label: 'Notes Logged',   value: 61,   sub: '+5% vs last period',  color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/20' },
  { icon: CheckCircle2,  label: 'Tasks Completed',value: 79,   sub: '+17% vs last period', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
]

export function ActivitySummary() {
  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRIC_CARDS.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity by day */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Activity by Day of Week</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ACTIVITY_BY_DAY} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{v}</span>} />
            <Bar dataKey="calls"  name="Calls"  fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="emails" name="Emails" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="notes"  name="Notes"  fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="tasks"  name="Tasks"  fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
