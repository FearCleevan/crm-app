// src/components/emails/CampaignDetailView.tsx
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatDate, formatTime, getStatusBadgeClass } from '@/lib/campaign-utils'
import type { Campaign } from '@/types/campaigns'
import { cn } from '@/lib/utils'

const MOCK_ACTIVITY = [
  { date: '2026-06-10', sent: 20, opened: 5 },
  { date: '2026-06-11', sent: 25, opened: 8 },
  { date: '2026-06-12', sent: 18, opened: 6 },
  { date: '2026-06-13', sent: 22, opened: 10 },
  { date: '2026-06-14', sent: 13, opened: 4 },
  { date: '2026-06-15', sent: 0,  opened: 0 },
  { date: '2026-06-16', sent: 0,  opened: 0 },
]

const MOCK_RECIPIENTS = [
  { id: '1', fullname: 'Sarah Mitchell', company: 'Mitchell Bakery',   email: 'sarah@mitchellbakery.com', country: 'US', status: 'opened',  lastActivity: '2026-06-11T14:30:00Z' },
  { id: '2', fullname: 'James Ortega',   company: 'Ortega Auto',       email: 'james@ortegaauto.com',     country: 'US', status: 'replied', lastActivity: '2026-06-14T09:10:00Z' },
  { id: '3', fullname: 'Amy Chen',       company: 'Chen Florist',      email: 'amy@chenflorist.com',      country: 'US', status: 'sent',    lastActivity: '2026-06-10T10:00:00Z' },
  { id: '4', fullname: 'Mark Williams',  company: 'Williams Plumbing', email: 'mark@williams.com',        country: 'US', status: 'bounced', lastActivity: '2026-06-10T10:05:00Z' },
]

const STAT_CARDS = (c: Campaign) => [
  { label: 'Recipients', value: c.total_recipients },
  { label: 'Sent',       value: c.total_sent       },
  { label: 'Pending',    value: c.total_recipients - c.total_sent },
  { label: 'Opened',     value: c.total_opened,  pct: c.total_sent ? `${Math.round(c.total_opened/c.total_sent*100)}%` : '—' },
  { label: 'Clicked',    value: c.total_clicked,       pct: c.total_sent ? `${Math.round(c.total_clicked/c.total_sent*100)}%` : '—' },
  { label: 'Replied',    value: c.total_replied,       pct: c.total_sent ? `${Math.round(c.total_replied/c.total_sent*100)}%` : '—' },
  { label: 'Bounced',    value: c.total_bounced,       pct: c.total_sent ? `${Math.round(c.total_bounced/c.total_sent*100)}%` : '—' },
  { label: 'Unsub',      value: c.total_unsubscribed,  pct: c.total_sent ? `${Math.round(c.total_unsubscribed/c.total_sent*100)}%` : '—' },
]

type TabFilter = 'all' | 'sent' | 'opened' | 'replied' | 'bounced'

interface Props {
  campaign: Campaign
  onBack: () => void
}

export function CampaignDetailView({ campaign, onBack }: Props) {
  const [tab, setTab] = useState<TabFilter>('all')

  const filtered = tab === 'all' ? MOCK_RECIPIENTS : MOCK_RECIPIENTS.filter(r => r.status === tab)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <button type="button" onClick={onBack} aria-label="Back to campaigns"
          className="flex items-center gap-1.5 h-7 px-2 rounded-lg hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
        </button>
        <div className="h-4 w-px bg-border" />
        <h2 className="text-sm font-bold text-foreground">{campaign.name}</h2>
        <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold capitalize', getStatusBadgeClass(campaign.status))}>
          {campaign.status}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 px-5 py-4 border-b border-border shrink-0">
        {STAT_CARDS(campaign).map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-3 py-2 text-center">
            <p className="text-base font-bold text-foreground">{s.value}</p>
            {s.pct && <p className="text-[9px] text-muted-foreground">{s.pct}</p>}
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <p className="text-xs font-semibold text-foreground mb-3">Daily Activity</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={MOCK_ACTIVITY}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => formatDate(d).replace(/,.*/, '')} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip labelFormatter={l => formatDate(l)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="sent"   stroke="#3b82f6" strokeWidth={2} dot={false} name="Sent"   />
            <Line type="monotone" dataKey="opened" stroke="#22c55e" strokeWidth={2} dot={false} name="Opened" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recipient table */}
      <div className="flex-1 px-5 pb-5">
        <div className="flex gap-1 mt-4 mb-3 border-b border-border">
          {(['all','sent','opened','replied','bounced'] as TabFilter[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`h-8 px-3 text-xs font-medium border-b-2 capitalize transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Full Name','Company','Email','Country','Status','Last Activity'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-2.5 pr-4 font-medium text-foreground whitespace-nowrap">{r.fullname}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">{r.company}</td>
                <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">{r.email}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">{r.country}</td>
                <td className="py-2.5 pr-4">
                  <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold capitalize', getStatusBadgeClass(r.status))}>
                    {r.status}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                  {formatDate(r.lastActivity)} {formatTime(r.lastActivity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
