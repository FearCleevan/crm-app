import { MoreHorizontal, Play, Pause, Pencil, Copy, Trash2, Zap, Clock, BarChart2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { TRIGGER_LABELS, ACTION_LABELS, ACTION_COLORS, type Workflow } from '@/constants/mockWorkflows'

function timeLabel(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface WorkflowCardProps {
  workflow: Workflow
  onToggle:    (id: string) => void
  onEdit:      (wf: Workflow) => void
  onDuplicate: (wf: Workflow) => void
  onDelete:    (id: string) => void
}

export function WorkflowCard({ workflow: wf, onToggle, onEdit, onDuplicate, onDelete }: WorkflowCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md hover:scale-[1.01] transition-all group">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0 mt-0.5',
          wf.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted')}>
          <Zap className={cn('h-5 w-5', wf.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground leading-snug">{wf.name}</h3>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold',
              wf.status === 'active'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400')}>
              {wf.status === 'active' ? 'Active' : 'Paused'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wf.description}</p>
        </div>

        {/* Actions menu */}
        <div className="relative shrink-0">
          <button type="button" aria-label="Workflow actions"
            onClick={() => setMenuOpen(v => !v)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-40 bg-card border border-border rounded-xl shadow-xl overflow-hidden py-1">
                <button type="button" onClick={() => { onToggle(wf.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                  {wf.status === 'active' ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Activate</>}
                </button>
                <button type="button" onClick={() => { onEdit(wf); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button type="button" onClick={() => { onDuplicate(wf); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </button>
                <div className="border-t border-border my-1" />
                <button type="button" onClick={() => { onDelete(wf.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trigger */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Trigger</span>
        <span className="text-xs font-medium text-foreground bg-muted px-2.5 py-1 rounded-lg">{TRIGGER_LABELS[wf.trigger]}</span>
      </div>

      {/* Action chips */}
      {wf.actions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {wf.actions.map((a, i) => (
            <span key={a.id} className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold', ACTION_COLORS[a.type])}>
              <span className="opacity-60 text-[10px]">{i + 1}</span> {ACTION_LABELS[a.type]}
            </span>
          ))}
        </div>
      )}

      {/* Stats row + toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3.5 w-3.5" />{wf.runCount.toLocaleString()} runs
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />Last: {timeLabel(wf.lastRun)}
          </span>
        </div>

        <Switch
          checked={wf.status === 'active'}
          onCheckedChange={() => onToggle(wf.id)}
          aria-label={wf.status === 'active' ? 'Pause workflow' : 'Activate workflow'}
        />
      </div>
    </div>
  )
}
