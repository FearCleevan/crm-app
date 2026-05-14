import { TrendingUp, TrendingDown } from 'lucide-react'
import { CAMPAIGN_STATS } from '@/constants/mockEmails'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const OPEN_RATE_DATA = [
  { day: 'Mon', rate: 41 }, { day: 'Tue', rate: 38 }, { day: 'Wed', rate: 35 },
  { day: 'Thu', rate: 44 }, { day: 'Fri', rate: 36 }, { day: 'Sat', rate: 22 }, { day: 'Sun', rate: 18 },
]

export function CampaignStats() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Campaign Tracking</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Last 30 days · All campaigns</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CAMPAIGN_STATS.map(({ label, value, change, positive }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {change} vs last period
            </div>
          </div>
        ))}
      </div>

      {/* Open rate by day */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-4">Open Rate by Day of Week</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={OPEN_RATE_DATA} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} unit="%" domain={[0, 60]} />
            <Tooltip
              formatter={v => [`${v}%`, 'Open Rate']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
            />
            <Bar dataKey="rate" name="Open Rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Best performing subject lines */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Top Performing Subject Lines</h4>
        </div>
        <div className="divide-y divide-border">
          {[
            { subject: 'Quick question about {{company}}',       sent: 284, openRate: '52%', clickRate: '18%' },
            { subject: 'Your custom Brisk CRM proposal is ready', sent: 196, openRate: '48%', clickRate: '24%' },
            { subject: 'Following up — did you get a chance to…', sent: 341, openRate: '41%', clickRate: '12%' },
            { subject: 'Re: {{company}} — next steps',           sent: 178, openRate: '39%', clickRate: '15%' },
          ].map(row => (
            <div key={row.subject} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors">
              <p className="flex-1 text-sm text-foreground truncate">{row.subject}</p>
              <span className="text-xs text-muted-foreground shrink-0">{row.sent} sent</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 w-12 text-right">{row.openRate}</span>
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 shrink-0 w-12 text-right">{row.clickRate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
