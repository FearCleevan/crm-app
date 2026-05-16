import { useState } from 'react'
import { Download, BarChart2, GitMerge, TrendingUp, Activity, Users } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ReportDateRangePicker, type DateRange } from '@/components/reports/ReportDateRangePicker'
import { LeadsReport } from '@/components/reports/LeadsReport'
import { ConversionFunnel } from '@/components/reports/ConversionFunnel'
import { RevenueOverTime } from '@/components/reports/RevenueOverTime'
import { ActivitySummary } from '@/components/reports/ActivitySummary'
import { UserPerformance } from '@/components/reports/UserPerformance'
import { analyticsService } from '@/services/analytics.service'
import { PROVIDERS } from '@/constants/mockData'
import { cn } from '@/lib/utils'

type ReportTab = 'leads' | 'funnel' | 'revenue' | 'activity' | 'users'

const TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'leads',    label: 'Leads Report',    icon: BarChart2  },
  { id: 'funnel',   label: 'Conv. Funnel',    icon: GitMerge   },
  { id: 'revenue',  label: 'Revenue',         icon: TrendingUp },
  { id: 'activity', label: 'Activity',        icon: Activity   },
  { id: 'users',    label: 'User Performance',icon: Users      },
]

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)    return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('leads')
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [exporting, setExporting] = useState(false)

  const currentLabel = TABS.find(t => t.id === activeTab)?.label ?? 'Report'

  async function exportCSV() {
    if (exporting) return
    setExporting(true)
    try {
      let csv = `Report: ${currentLabel}\nExported: ${new Date().toLocaleString()}\nPeriod: ${dateRange}\n\n`

      if (activeTab === 'leads') {
        const data = await analyticsService.getLeadsReportData(dateRange)
        const byProvider = data.by_provider.map(r => ({
          Source: PROVIDERS.find(p => p.code === r.code)?.name ?? r.code,
          Leads: r.count,
        }))
        const byUser = data.by_user.map(u => ({
          User: u.name.trim() || u.email,
          Role: u.role,
          'Total Leads': u.leads,
          Contacted: u.contacted,
          Qualified: u.qualified,
          'Conv. Rate': u.leads ? `${Math.round((u.qualified / u.leads) * 100)}%` : '—',
        }))
        csv += `LEADS BY SOURCE\n${Papa.unparse(byProvider)}\n\nLEADS BY USER\n${Papa.unparse(byUser)}`
      } else if (activeTab === 'funnel') {
        const d = await analyticsService.getConversionFunnel(dateRange)
        const rows = [
          { Stage: 'Total Leads',   Count: d.total,     'Of Total': '100%' },
          { Stage: 'Contacted',     Count: d.contacted, 'Of Total': d.total ? `${Math.round((d.contacted / d.total) * 100)}%` : '—' },
          { Stage: 'Qualified',     Count: d.qualified, 'Of Total': d.total ? `${Math.round((d.qualified / d.total) * 100)}%` : '—' },
          { Stage: 'Proposal Sent', Count: d.proposals, 'Of Total': d.total ? `${Math.round((d.proposals / d.total) * 100)}%` : '—' },
          { Stage: 'Closed Won',    Count: d.won,       'Of Total': d.total ? `${Math.round((d.won / d.total) * 100)}%` : '—' },
        ]
        csv += Papa.unparse(rows)
      } else if (activeTab === 'revenue') {
        const data = await analyticsService.getRevenueByMonth(24)
        const rows = data.map(d => ({ Month: d.month, Revenue: fmt(d.value), Raw: d.value }))
        csv += Papa.unparse(rows)
      } else if (activeTab === 'activity') {
        const d = await analyticsService.getActivityBreakdown(dateRange)
        const rows = [
          { Type: 'Calls',    Count: d.total_calls    },
          { Type: 'Emails',   Count: d.total_emails   },
          { Type: 'Notes',    Count: d.total_notes    },
          { Type: 'Meetings', Count: d.total_meetings },
        ]
        csv += Papa.unparse(rows)
      } else if (activeTab === 'users') {
        const data = await analyticsService.getUserPerformanceStats()
        const rows = data.map(u => ({
          User:       [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
          Role:       u.role,
          Leads:      u.leads,
          Deals:      u.deals,
          Revenue:    fmt(u.revenue),
          Activities: u.activities,
        }))
        csv += Papa.unparse(rows)
      }

      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${currentLabel.toLowerCase().replace(/\s/g, '-')}-${dateRange}-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${currentLabel} exported`)
    } catch {
      toast.error('Export failed — please try again')
    } finally {
      setExporting(false)
    }
  }

  const exportBtn = (
    <button
      type="button"
      onClick={exportCSV}
      disabled={exporting}
      className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {exporting ? 'Exporting…' : 'Export CSV'}
    </button>
  )

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">{exportBtn}</div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Top bar: date range */}
        <div className="px-6 pt-5 pb-4 border-b border-border bg-card space-y-4 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Analytics & Reports</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Insights across leads, deals, and team performance</p>
            </div>
            <div className="md:hidden">{exportBtn}</div>
          </div>
          <ReportDateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Mobile tab bar */}
        <div className="md:hidden flex items-center gap-1 overflow-x-auto px-4 py-3 border-b border-border bg-card shrink-0 no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0',
                activeTab === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent bg-card',
              )}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar nav (tablet+) */}
          <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-border bg-card py-4 gap-1 px-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors',
                  activeTab === id
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}>
                <Icon className={cn('h-4 w-4 shrink-0', activeTab === id ? 'text-brand-500' : '')} />
                {label}
              </button>
            ))}
          </aside>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {activeTab === 'leads'    && <LeadsReport    dateRange={dateRange} />}
            {activeTab === 'funnel'   && <ConversionFunnel dateRange={dateRange} />}
            {activeTab === 'revenue'  && <RevenueOverTime  dateRange={dateRange} />}
            {activeTab === 'activity' && <ActivitySummary  dateRange={dateRange} />}
            {activeTab === 'users'    && <UserPerformance  dateRange={dateRange} />}
          </main>
        </div>
      </PageWrapper>
    </>
  )
}
