import { CheckCircle2, XCircle, SkipForward, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { type WorkflowRun } from '@/constants/mockWorkflows'

const STATUS_META: Record<WorkflowRun['status'], { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Success' },
  failed:  { icon: XCircle,      color: 'text-rose-500',                          bg: 'bg-rose-100 dark:bg-rose-900/30',       label: 'Failed'  },
  skipped: { icon: SkipForward,  color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-100 dark:bg-amber-900/20',     label: 'Skipped' },
}

function timeLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface WorkflowLogProps {
  runs: WorkflowRun[]
  loading: boolean
}

export function WorkflowLog({ runs, loading }: WorkflowLogProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Workflow Run Log</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Recent automation executions across all workflows</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading run log…</div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Clock className="h-8 w-8 opacity-20" />
          <p className="text-sm font-medium">No runs yet</p>
          <p className="text-xs">Workflow runs will appear here once automations start executing</p>
        </div>
      ) : (
      <div className="divide-y divide-border">
        {runs.map(run => {
          const meta = STATUS_META[run.status]
          const Icon = meta.icon
          return (
            <div key={run.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors group">
              <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.bg)}>
                <Icon className={cn('h-3.5 w-3.5', meta.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{run.workflowName}</span>
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', meta.bg, meta.color)}>{meta.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground truncate">{run.recordLabel}</span>
                  {run.error && <span className="text-[11px] text-rose-500">· {run.error}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-right">
                {run.duration !== '—' && (
                  <span className="text-xs text-muted-foreground hidden sm:block">{run.duration}</span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />{timeLabel(run.timestamp)}
                </span>
                <Link to={run.recordLink}
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" title="View record">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
