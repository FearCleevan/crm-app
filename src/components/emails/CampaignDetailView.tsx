// src/components/emails/CampaignDetailView.tsx
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatDate, formatTime, getStatusBadgeClass } from '@/lib/campaign-utils'
import type { Campaign, CampaignRecipient } from '@/types/campaigns'
import { cn } from '@/lib/utils'

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

interface DailyActivity { date: string; sent: number; opened: number }

// Derive a per-day sent/opened series from recipient timestamps (no separate
// email_events query needed — campaign_recipients already carries sent_at/opened_at).
function buildDailyActivity(recipients: CampaignRecipient[]): DailyActivity[] {
  const byDate = new Map<string, DailyActivity>()
  function bump(ts: string | null, field: 'sent' | 'opened') {
    if (!ts) return
    const day = ts.slice(0, 10) // YYYY-MM-DD
    const row = byDate.get(day) ?? { date: day, sent: 0, opened: 0 }
    row[field] += 1
    byDate.set(day, row)
  }
  for (const r of recipients) {
    bump(r.sent_at, 'sent')
    bump(r.opened_at, 'opened')
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function lastActivityOf(r: CampaignRecipient): string {
  return r.replied_at ?? r.clicked_at ?? r.opened_at ?? r.bounced_at ?? r.unsubscribed_at ?? r.sent_at ?? r.created_at
}

interface Props {
  campaign: Campaign
  onBack: () => void
  getRecipients: (campaignId: string) => Promise<CampaignRecipient[]>
}

export function CampaignDetailView({ campaign, onBack, getRecipients }: Props) {
  const [tab, setTab] = useState<TabFilter>('all')
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getRecipients(campaign.id)
      .then(rows => { if (!cancelled) setRecipients(rows) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [campaign.id, getRecipients])

  const dailyActivity = useMemo(() => buildDailyActivity(recipients), [recipients])
  const filtered = tab === 'all' ? recipients : recipients.filter(r => r.status === tab)

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
        {dailyActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">
            {loading ? 'Loading…' : 'No email activity yet'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => formatDate(d).replace(/,.*/, '')} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip labelFormatter={l => formatDate(l)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="sent"   stroke="#3b82f6" strokeWidth={2} dot={false} name="Sent"   />
              <Line type="monotone" dataKey="opened" stroke="#22c55e" strokeWidth={2} dot={false} name="Opened" />
            </LineChart>
          </ResponsiveContainer>
        )}
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
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Loading recipients…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No recipients in this view</p>
        ) : (
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
                  <td className="py-2.5 pr-4 font-medium text-foreground whitespace-nowrap">{r.prospects?.fullname ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.prospects?.company ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">{r.prospects?.email ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{r.prospects?.country ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold capitalize', getStatusBadgeClass(r.status))}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                    {formatDate(lastActivityOf(r))} {formatTime(lastActivityOf(r))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
