import { cn } from '@/lib/utils'

// ── Status Badge ──────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  'New':        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Contacted':  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Qualified':  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Closed':     'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground')}>
      {status}
    </span>
  )
}

// ── Email Badge ───────────────────────────────────────────────
const EMAIL_STYLES: Record<string, { style: string; label: string }> = {
  'EMA000': { style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Valid' },
  'EMA001': { style: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',           label: 'Invalid' },
  'EMA002': { style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       label: 'Risky' },
  'EMA003': { style: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',       label: 'Unknown' },
  'EMA004': { style: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',   label: 'Catch-All' },
}

export function EmailBadge({ code }: { code: string }) {
  const meta = EMAIL_STYLES[code] ?? { style: 'bg-muted text-muted-foreground', label: code }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', meta.style)}>
      {meta.label}
    </span>
  )
}

// ── Disposition Badge ─────────────────────────────────────────
const DISP_STYLES: Record<string, { style: string; label: string }> = {
  'DIS000': { style: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',       label: 'Not Contacted' },
  'DIS001': { style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Interested' },
  'DIS002': { style: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',           label: 'Not Interested' },
  'DIS003': { style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',       label: 'Callback' },
  'DIS004': { style: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',               label: 'Do Not Contact' },
  'DIS005': { style: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400',           label: 'Unqualified' },
  'DIS006': { style: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',   label: 'Hot Lead' },
}

export function DispositionBadge({ code }: { code: string }) {
  const meta = DISP_STYLES[code] ?? { style: 'bg-muted text-muted-foreground', label: code }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', meta.style)}>
      {meta.label}
    </span>
  )
}
