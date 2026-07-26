import { useState, useCallback } from 'react'
import { Users, TrendingUp, DollarSign, Sparkles, SlidersHorizontal, RefreshCw, Upload, Download, ChevronDown } from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { CalendarWidget } from '@/components/dashboard/CalendarWidget'
import { LeadsManagementCard } from '@/components/dashboard/LeadsManagementCard'
import { RetentionChart } from '@/components/dashboard/RetentionChart'
import { LocationsCard } from '@/components/dashboard/LocationsCard'
import { WidgetCustomizerPanel, type WidgetConfig } from '@/components/dashboard/WidgetCustomizerPanel'
import { useDashboardData } from '@/hooks/useDashboardData'

const STORAGE_KEY = 'paul_dashboard_widgets'

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'metrics',   label: 'Metric Cards',    description: 'Leads, Revenue, Avg Deal Size',  visible: true },
  { id: 'revenue',   label: 'Revenue Chart',   description: 'Revenue over time',              visible: true },
  { id: 'calendar',  label: 'Calendar',        description: 'Activity calendar',              visible: true },
  { id: 'leads',     label: 'Leads Management',description: 'Lead source breakdown',          visible: true },
  { id: 'retention', label: 'Segment Chart',   description: 'Prospects by company segment',  visible: true },
  { id: 'locations', label: 'Locations',       description: 'Geographic distribution',        visible: true },
]

function loadWidgets(): WidgetConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_WIDGETS
    const saved: { id: string; visible: boolean }[] = JSON.parse(stored)
    return DEFAULT_WIDGETS.map(w => {
      const override = saved.find(s => s.id === w.id)
      return override ? { ...w, visible: override.visible } : w
    })
  } catch {
    return DEFAULT_WIDGETS
  }
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)    return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

export function DashboardPage() {
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgets)

  const { loading, metrics, revenueData, breakdown, countries, segments } = useDashboardData()

  const toggleWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(w => ({ id: w.id, visible: w.visible }))))
      return next
    })
  }, [])

  function exportCSV() {
    const metricRows = [
      { Metric: 'Total Prospects', Value: metrics?.total_prospects ?? '—', Change: `+${metrics?.new_this_week ?? 0} this week` },
      { Metric: 'Total Revenue',   Value: fmt(metrics?.total_revenue ?? 0), Change: '' },
      { Metric: 'Avg Deal Size',   Value: fmt(metrics?.avg_deal_size ?? 0),  Change: '' },
    ]
    const revRows = revenueData.map(d => ({ Month: d.month, Revenue: `$${d.value.toLocaleString()}` }))

    const combined = [
      `Dashboard Summary Export — ${new Date().toLocaleDateString()}`,
      '',
      'KEY METRICS',
      Papa.unparse(metricRows),
      '',
      'MONTHLY REVENUE',
      Papa.unparse(revRows),
    ].join('\n')

    const blob = new Blob([combined], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `dashboard-export-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Dashboard exported to CSV')
  }

  const visible = (id: string) => widgets.find(w => w.id === id)?.visible ?? true

  // Derive metric card values
  const totalProspects = metrics?.total_prospects ?? 0
  const newThisWeek    = metrics?.new_this_week   ?? 0
  const totalRevenue   = metrics?.total_revenue   ?? 0
  const avgDealSize    = metrics?.avg_deal_size   ?? 0
  const closedWon      = metrics?.closed_won_count ?? 0

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <button type="button" className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors">
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI
          </button>
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Customize Widget
          </button>
          <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <RefreshCw className="h-3 w-3" />
            {loading ? 'Loading…' : 'Live data'}
          </div>
          <button type="button" className="flex items-center gap-1 h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
            <Upload className="h-3.5 w-3.5" />
            Imports
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-foreground hover:bg-foreground/90 text-background text-xs font-semibold transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Exports
          </button>
        </div>
      </TopbarSlot>

      <PageWrapper className="space-y-5">
        <div className="grid grid-cols-12 gap-5">

          {/* Metric cards */}
          {visible('metrics') && (
            <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                title="Total Prospects"
                value={loading ? '…' : totalProspects.toLocaleString()}
                change={newThisWeek}
                unit=""
                trend="up"
                changeLabel={`+${newThisWeek} this week`}
                icon={Users}
              />
              <MetricCard
                title="Total Revenue"
                value={loading ? '…' : fmt(totalRevenue)}
                change={closedWon}
                unit=""
                trend="up"
                changeLabel={`${closedWon} deals closed`}
                icon={DollarSign}
              />
              <MetricCard
                title="Avg Deal Size"
                value={loading ? '…' : fmt(avgDealSize)}
                change={0}
                trend="up"
                changeLabel="Closed Won avg"
                icon={TrendingUp}
              />
            </div>
          )}

          {/* Calendar — right column, spans both rows */}
          {visible('calendar') && (
            <div className={`col-span-12 lg:col-span-4 lg:row-span-2 ${visible('metrics') ? 'lg:row-start-1' : ''}`}>
              <div className="h-full min-h-[320px] md:min-h-[420px]">
                <CalendarWidget />
              </div>
            </div>
          )}

          {/* Revenue chart */}
          {visible('revenue') && (
            <div className="col-span-12 lg:col-span-8">
              <RevenueChart data={revenueData} />
            </div>
          )}
        </div>

        {/* Bottom row */}
        {(visible('leads') || visible('retention') || visible('locations')) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {visible('leads')     && <LeadsManagementCard breakdown={breakdown} />}
            {visible('retention') && <RetentionChart segments={segments} />}
            {visible('locations') && <LocationsCard countries={countries} />}
          </div>
        )}
      </PageWrapper>

      <WidgetCustomizerPanel
        open={customizerOpen}
        widgets={widgets}
        onToggle={toggleWidget}
        onClose={() => setCustomizerOpen(false)}
      />
    </>
  )
}
