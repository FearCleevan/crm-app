import { useState, useCallback } from 'react'
import { Users, Percent, Clock, Sparkles, SlidersHorizontal, RefreshCw, Upload, Download, ChevronDown } from 'lucide-react'
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
import { MOCK_REVENUE_DATA } from '@/constants/mockData'

const STORAGE_KEY = 'brisk_dashboard_widgets'

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'metrics',  label: 'Metric Cards',      description: 'Leads, Conversion Rate, CLV',  visible: true },
  { id: 'revenue',  label: 'Revenue Chart',      description: 'Revenue over time',             visible: true },
  { id: 'calendar', label: 'Calendar',           description: 'Activity calendar',             visible: true },
  { id: 'leads',    label: 'Leads Management',   description: 'Lead source breakdown',         visible: true },
  { id: 'retention',label: 'Retention Chart',    description: 'Customer retention metrics',    visible: true },
  { id: 'locations',label: 'Locations',          description: 'Geographic distribution',       visible: true },
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

export function DashboardPage() {
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgets)

  const toggleWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(w => ({ id: w.id, visible: w.visible }))))
      return next
    })
  }, [])

  function exportCSV() {
    const metrics = [
      { Metric: 'Total Leads',       Value: '129',  Change: '+24 vs last week'  },
      { Metric: 'Conversion Rate',   Value: '24%',  Change: '+8 vs last week'   },
      { Metric: 'Avg. CLV',          Value: '14d',  Change: '+1d vs last week'  },
    ]
    const revenue = MOCK_REVENUE_DATA.map(d => ({ Month: d.month, Revenue: `$${d.value.toLocaleString()}` }))

    const metricsCSV  = Papa.unparse(metrics)
    const revenueCSV  = Papa.unparse(revenue)
    const combined    = `Dashboard Summary Export — ${new Date().toLocaleDateString()}\n\nKEY METRICS\n${metricsCSV}\n\nMONTHLY REVENUE\n${revenueCSV}`

    const blob = new Blob([combined], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `dashboard-export-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Dashboard exported to CSV')
  }

  const visible = (id: string) => widgets.find(w => w.id === id)?.visible ?? true

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
            Last updated now
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
              <MetricCard title="Leads"           value="129"  change={8}  trend="up"   changeLabel="+24 vs last week" icon={Users}   />
              <MetricCard title="Conversion Rate" value="24%"  change={2}  trend="up"   changeLabel="+8 vs last week"  icon={Percent} />
              <MetricCard title="CLV"             value="14d"  change={-4} trend="down" changeLabel="+1d vs last week" icon={Clock}   />
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
              <RevenueChart />
            </div>
          )}
        </div>

        {/* Bottom row */}
        {(visible('leads') || visible('retention') || visible('locations')) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {visible('leads')     && <LeadsManagementCard />}
            {visible('retention') && <RetentionChart />}
            {visible('locations') && <LocationsCard />}
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
