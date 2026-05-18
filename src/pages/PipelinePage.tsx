import { useState } from 'react'
import {
  Workflow, RefreshCw, X, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Clock, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { format } from 'date-fns'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { PipelineUploadModal } from '@/components/pipeline/PipelineUploadModal'
import { usePipelineSessions } from '@/hooks/usePipelineSessions'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import type { PipelineSession } from '@/types/pipeline'
import { CRM_FIELDS } from '@/types/pipeline'

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PipelineSession['status'] }) {
  const map: Record<PipelineSession['status'], { label: string; cls: string; icon: React.ReactNode }> = {
    done:      { label: 'Done',      cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed:    { label: 'Failed',    cls: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',             icon: <AlertCircle className="h-3 w-3" /> },
    importing: { label: 'Importing', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',             icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    mapping:   { label: 'Mapping',   cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',         icon: <Clock className="h-3 w-3" /> },
    pending:   { label: 'Pending',   cls: 'bg-muted text-muted-foreground',                                               icon: <Clock className="h-3 w-3" /> },
  }
  const { label, cls, icon } = map[status] ?? map.pending
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', cls)}>
      {icon}{label}
    </span>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
function SessionDetailDrawer({
  session,
  onClose,
}: {
  session: PipelineSession
  onClose: () => void
}) {
  const [mapExpanded, setMapExpanded] = useState(false)

  const columnMap = session.column_map ?? {}
  const mapEntries = Object.entries(columnMap)

  function crmLabel(key: string) {
    return CRM_FIELDS.find(f => f.key === key)?.label ?? key
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-foreground text-sm truncate max-w-[240px]">{session.file_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Status + date */}
          <div className="flex items-center justify-between">
            <StatusBadge status={session.status} />
            <span className="text-xs text-muted-foreground">
              {format(new Date(session.created_at), 'MMM d, yyyy · h:mm a')}
            </span>
          </div>

          {/* Error message */}
          {session.error_message && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-700 dark:text-rose-400">{session.error_message}</p>
            </div>
          )}

          {/* Row counts */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Rows',    value: session.file_rows     },
              { label: 'Valid Rows',    value: session.mapped_rows   },
              { label: 'Skipped Rows',  value: session.skipped_rows  },
              { label: 'Imported',      value: session.imported_rows },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-foreground">{s.value.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Column map */}
          {mapEntries.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setMapExpanded(p => !p)}
                className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-brand-500 transition-colors"
              >
                <span>Column Map ({mapEntries.length} fields)</span>
                {mapExpanded
                  ? <ChevronUp className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />
                }
              </button>
              {mapExpanded && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-2 gap-0 text-[10px] font-semibold text-muted-foreground bg-muted/50 px-3 py-2 border-b border-border">
                    <span>Source Column</span>
                    <span>CRM Field</span>
                  </div>
                  <div className="divide-y divide-border max-h-60 overflow-y-auto">
                    {mapEntries.map(([src, crm]) => (
                      <div key={src} className="grid grid-cols-2 gap-2 px-3 py-2 text-xs">
                        <span className="text-muted-foreground truncate" title={src}>{src}</span>
                        <span className="text-foreground font-medium truncate">{crmLabel(crm)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function PipelinePage() {
  const { user } = useAuth()
  const { sessions, loading, page, hasMore, nextPage, prevPage, refresh } = usePipelineSessions()
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [selected, setSelected] = useState<PipelineSession | null>(null)

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{sessions.length} sessions</span>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">

        {/* Toolbar */}
        <div className="px-4 pt-4 pb-3 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-brand-500" />
            <h1 className="font-semibold text-foreground text-sm">Pipeline Sessions</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={refresh} aria-label="Refresh"
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-muted-foreground transition-colors">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button type="button" onClick={() => setPipelineOpen(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Workflow className="h-4 w-4" />
              Run New Pipeline
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading sessions…</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
              <div className="h-12 w-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                <Workflow className="h-6 w-6 text-brand-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground">No pipeline runs yet</p>
                <p className="text-sm text-muted-foreground mt-1">Run your first pipeline to see session history here.</p>
              </div>
              <button type="button" onClick={() => setPipelineOpen(true)}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                Run New Pipeline
              </button>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b border-border sticky top-0">
                <tr>
                  {['Status', 'File', 'Date', 'Total', 'Imported', 'Skipped'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-foreground font-medium truncate" title={s.file_name}>{s.file_name}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(s.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-foreground tabular-nums">{s.file_rows.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={cn(
                        s.imported_rows > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                      )}>
                        {s.imported_rows.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={cn(
                        s.skipped_rows > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                      )}>
                        {s.skipped_rows.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {(page > 1 || hasMore) && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0">
            <button type="button" onClick={prevPage} disabled={page === 1}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <button type="button" onClick={nextPage} disabled={!hasMore}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </PageWrapper>

      {/* Detail drawer */}
      {selected && (
        <SessionDetailDrawer
          session={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Pipeline wizard */}
      <PipelineUploadModal
        open={pipelineOpen}
        onClose={() => setPipelineOpen(false)}
        onImported={refresh}
        userId={user?.id ?? ''}
      />
    </>
  )
}
