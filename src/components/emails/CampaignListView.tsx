// src/components/emails/CampaignListView.tsx
import { useState } from 'react'
import { Plus, MoreHorizontal, Play, Pause, Pencil, Trash2, Mail, Send, Eye, MessageSquare } from 'lucide-react'
import { formatDate, getStatusBadgeClass } from '@/lib/campaign-utils'
import { useAuth } from '@/context/AuthContext'
import type { MockCampaign } from '@/constants/mockCampaigns'
import { cn } from '@/lib/utils'

interface Props {
  campaigns: MockCampaign[]
  onNew: () => void
  onEdit: (c: MockCampaign) => void
  onView: (c: MockCampaign) => void
  onDelete: (id: string) => void
  onTogglePause: (id: string) => void
}

export function CampaignListView({ campaigns, onNew, onEdit, onView, onDelete, onTogglePause }: Props) {
  const { role } = useAuth()
  const isSuperAdmin = role === 'Super Admin'
  const canManage    = role === 'Super Admin' || role === 'Data Analyst'
  const [menuId, setMenuId] = useState<string | null>(null)

  const totalSent    = campaigns.reduce((s, c) => s + c.total_sent, 0)
  const totalOpened  = campaigns.reduce((s, c) => s + c.total_opened, 0)
  const totalReplied = campaigns.reduce((s, c) => s + c.total_replied, 0)
  const avgOpen   = totalSent ? Math.round((totalOpened  / totalSent) * 100 * 10) / 10 : 0
  const avgReply  = totalSent ? Math.round((totalReplied / totalSent) * 100 * 10) / 10 : 0

  const stats = [
    { label: 'Total Campaigns',  value: String(campaigns.length), icon: Mail },
    { label: 'Total Emails Sent', value: String(totalSent),       icon: Send },
    { label: 'Avg Open Rate',     value: `${avgOpen}%`,           icon: Eye  },
    { label: 'Avg Reply Rate',    value: `${avgReply}%`,          icon: MessageSquare },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-base font-bold text-foreground">Campaigns</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your cold outreach sequences</p>
        </div>
        {canManage && (
          <button type="button" onClick={onNew} aria-label="New campaign"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 border-b border-border shrink-0">
        {stats.map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
              <s.icon className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto px-5 py-4">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-foreground">No campaigns yet</p>
            <p className="text-xs text-muted-foreground">Create your first outreach campaign to start reaching prospects</p>
            {canManage && (
              <button type="button" onClick={onNew}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors mt-1">
                <Plus className="h-3.5 w-3.5" /> Create Campaign
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Name','Status','Recipients','Sent','Opened','Replied','Created',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const openPct  = c.total_sent ? Math.round((c.total_opened  / c.total_sent) * 100) : 0
                const replyPct = c.total_sent ? Math.round((c.total_replied / c.total_sent) * 100) : 0
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 pr-4">
                      <button type="button" onClick={() => onView(c)}
                        className="font-medium text-foreground hover:text-primary hover:underline text-left transition-colors">
                        {c.name}
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn('inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold capitalize', getStatusBadgeClass(c.status))}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.total_recipients}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.total_sent}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.total_opened} {c.total_sent > 0 && <span className="text-[10px]">({openPct}%)</span>}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.total_replied} {c.total_sent > 0 && <span className="text-[10px]">({replyPct}%)</span>}</td>
                    <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="py-3 relative">
                      <button type="button" aria-label="Campaign actions" onClick={() => setMenuId(id => id === c.id ? null : c.id)}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuId === c.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-40 bg-popover border border-border rounded-xl shadow-lg py-1 overflow-hidden">
                          {canManage && (
                            <button type="button" onClick={() => { onEdit(c); setMenuId(null) }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors">
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                          )}
                          {canManage && (
                            <button type="button" onClick={() => { onTogglePause(c.id); setMenuId(null) }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors">
                              {c.status === 'active' ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Resume</>}
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button type="button" onClick={() => { onDelete(c.id); setMenuId(null) }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
