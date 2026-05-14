import { useState } from 'react'
import { Download, BarChart2, GitMerge, TrendingUp, Activity, Users } from 'lucide-react'
import { toast } from 'sonner'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ReportDateRangePicker, type DateRange } from '@/components/reports/ReportDateRangePicker'
import { LeadsReport } from '@/components/reports/LeadsReport'
import { ConversionFunnel } from '@/components/reports/ConversionFunnel'
import { RevenueOverTime } from '@/components/reports/RevenueOverTime'
import { ActivitySummary } from '@/components/reports/ActivitySummary'
import { UserPerformance } from '@/components/reports/UserPerformance'
import { cn } from '@/lib/utils'

type ReportTab = 'leads' | 'funnel' | 'revenue' | 'activity' | 'users'

const TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'leads',    label: 'Leads Report',    icon: BarChart2  },
  { id: 'funnel',   label: 'Conv. Funnel',    icon: GitMerge   },
  { id: 'revenue',  label: 'Revenue',         icon: TrendingUp },
  { id: 'activity', label: 'Activity',        icon: Activity   },
  { id: 'users',    label: 'User Performance',icon: Users      },
]

function mockExport(report: string) {
  const csv = `Report: ${report}\nExported: ${new Date().toLocaleString()}\n\n(Mock data — full export available after backend integration)\n`
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${report.toLowerCase().replace(/\s/g, '-')}-report-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`${report} report exported`)
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('leads')
  const [dateRange, setDateRange] = useState<DateRange>('30d')

  const currentLabel = TABS.find(t => t.id === activeTab)?.label ?? 'Report'

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <button type="button" onClick={() => mockExport(currentLabel)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Top bar: date range */}
        <div className="px-6 pt-5 pb-4 border-b border-border bg-card space-y-4 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Analytics & Reports</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Insights across leads, deals, and team performance</p>
            </div>
            <button type="button" onClick={() => mockExport(currentLabel)}
              className="md:hidden flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
          <ReportDateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar nav */}
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

          {/* Mobile tab bar */}
          <div className="md:hidden flex items-center gap-1 overflow-x-auto px-4 py-3 border-b border-border bg-card shrink-0 absolute left-0 right-0" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border',
                  activeTab === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent bg-card',
                )}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {activeTab === 'leads'    && <LeadsReport />}
            {activeTab === 'funnel'   && <ConversionFunnel />}
            {activeTab === 'revenue'  && <RevenueOverTime />}
            {activeTab === 'activity' && <ActivitySummary />}
            {activeTab === 'users'    && <UserPerformance />}
          </main>
        </div>
      </PageWrapper>
    </>
  )
}
