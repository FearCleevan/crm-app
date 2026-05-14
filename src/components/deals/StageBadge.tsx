import type { Deal } from '@/constants/mockData'

export const STAGE_BADGE: Record<Deal['stage'], { label: string; cls: string }> = {
  'New Lead':      { label: 'New Lead',      cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  'Contacted':     { label: 'Contacted',     cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  'Qualified':     { label: 'Qualified',     cls: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' },
  'Proposal Sent': { label: 'Proposal Sent', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  'Negotiation':   { label: 'Negotiation',   cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
  'Closed Won':    { label: 'Closed Won',    cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
  'Closed Lost':   { label: 'Closed Lost',   cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' },
}
