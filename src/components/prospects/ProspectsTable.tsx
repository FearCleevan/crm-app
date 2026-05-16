import { useState, useCallback, useEffect, useRef, memo } from 'react'
import {
  ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Trash2, Mail,
  Columns3, AlignJustify, Check,
} from 'lucide-react'
import { format, isValid, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { StatusBadge, EmailBadge, DispositionBadge } from './ProspectBadges'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import type { Prospect } from '@/constants/mockData'
import { PROVIDERS } from '@/constants/mockData'

// ── Column registry ────────────────────────────────────────────
interface ColDef {
  key: string
  label: string
  defaultOn: boolean
  sortable: boolean
  width: number
}

const ALL_COLUMNS: ColDef[] = [
  { key: 'fullname',           label: 'Full Name',     defaultOn: true,  sortable: true,  width: 180 },
  { key: 'firstname',          label: 'First Name',    defaultOn: false, sortable: true,  width: 110 },
  { key: 'lastname',           label: 'Last Name',     defaultOn: false, sortable: true,  width: 110 },
  { key: 'jobtitle',           label: 'Job Title',     defaultOn: true,  sortable: true,  width: 140 },
  { key: 'company',            label: 'Company',       defaultOn: true,  sortable: true,  width: 140 },
  { key: 'email',              label: 'Email',         defaultOn: true,  sortable: true,  width: 210 },
  { key: 'altphonenumber',     label: 'Alt Phone',     defaultOn: false, sortable: false, width: 130 },
  { key: 'companyphonenumber', label: 'Co. Phone',     defaultOn: false, sortable: false, width: 130 },
  { key: 'website',            label: 'Website',       defaultOn: false, sortable: false, width: 160 },
  { key: 'personallinkedin',   label: 'LinkedIn',      defaultOn: false, sortable: false, width: 100 },
  { key: 'companylinkedin',    label: 'Co. LinkedIn',  defaultOn: false, sortable: false, width: 110 },
  { key: 'city',               label: 'City',          defaultOn: false, sortable: true,  width: 110 },
  { key: 'state',              label: 'State',         defaultOn: false, sortable: true,  width: 100 },
  { key: 'country',            label: 'Country',       defaultOn: false, sortable: true,  width: 110 },
  { key: 'industry',           label: 'Industry',      defaultOn: false, sortable: true,  width: 130 },
  { key: 'seniority',          label: 'Seniority',     defaultOn: false, sortable: true,  width: 100 },
  { key: 'department',         label: 'Department',    defaultOn: false, sortable: true,  width: 120 },
  { key: 'employeesize',       label: 'Employees',     defaultOn: false, sortable: true,  width: 90  },
  { key: 'annualrevenue',      label: 'Annual Rev.',   defaultOn: false, sortable: true,  width: 110 },
  { key: 'emailcode',          label: 'Email Status',  defaultOn: true,  sortable: false, width: 100 },
  { key: 'dispositioncode',    label: 'Disposition',   defaultOn: true,  sortable: false, width: 120 },
  { key: 'providercode',       label: 'Provider',      defaultOn: true,  sortable: false, width: 90  },
  { key: 'status',             label: 'Status',        defaultOn: true,  sortable: true,  width: 100 },
  { key: 'createdon',          label: 'Created',       defaultOn: true,  sortable: true,  width: 100 },
]

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter(c => c.defaultOn).map(c => c.key))
const LS_COLS    = 'prospects_visible_cols'
const LS_COMPACT = 'prospects_compact'

function loadVisibleCols(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_COLS)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set(DEFAULT_VISIBLE)
}

function saveVisibleCols(s: Set<string>) {
  try { localStorage.setItem(LS_COLS, JSON.stringify(Array.from(s))) } catch { /* ignore */ }
}

function loadCompact(): boolean {
  return localStorage.getItem(LS_COMPACT) === 'true'
}

// ── Helpers ────────────────────────────────────────────────────
type SortKey = keyof Prospect
type SortDir = 'asc' | 'desc'

function providerName(code: string) {
  return PROVIDERS.find(p => p.code === code)?.name ?? code
}

function safeDate(d: string | undefined | null): string {
  if (!d) return '—'
  const date = parseISO(d)
  return isValid(date) ? format(date, 'MMM d, yyyy') : '—'
}

// ── Cell renderer ──────────────────────────────────────────────
const CellContent = memo(function CellContent({ col, p, compact }: { col: ColDef; p: Prospect; compact: boolean }) {
  switch (col.key) {
    case 'fullname':
      return (
        <div className="flex items-center gap-2 min-w-0">
          {!compact && (
            <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
              {(p.firstname?.[0] ?? '').toUpperCase()}{(p.lastname?.[0] ?? '').toUpperCase()}
            </div>
          )}
          <span className="font-medium text-foreground truncate">{p.fullname || '—'}</span>
        </div>
      )
    case 'email':
      return (
        <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()}
          className="hover:text-brand-500 transition-colors flex items-center gap-1 text-muted-foreground truncate min-w-0">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{p.email}</span>
        </a>
      )
    case 'emailcode':      return <EmailBadge code={p.emailcode} />
    case 'dispositioncode': return <DispositionBadge code={p.dispositioncode} />
    case 'providercode':   return <span className="text-xs text-muted-foreground">{providerName(p.providercode)}</span>
    case 'status':         return <StatusBadge status={p.status} />
    case 'createdon':      return <span className="text-xs text-muted-foreground whitespace-nowrap">{safeDate(p.createdon)}</span>
    case 'annualrevenue':  return <span className="text-xs text-muted-foreground">{p.annualrevenue ? `$${Number(p.annualrevenue).toLocaleString()}` : '—'}</span>
    case 'employeesize':   return <span className="text-xs text-muted-foreground">{p.employeesize ? Number(p.employeesize).toLocaleString() : '—'}</span>
    case 'website':
      return p.website ? (
        <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
          target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="text-xs text-brand-500 hover:underline truncate block max-w-[140px]">
          {p.website}
        </a>
      ) : <span className="text-xs text-muted-foreground">—</span>
    case 'personallinkedin':
      return p.personallinkedin ? (
        <a href={p.personallinkedin} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="text-xs text-brand-500 hover:underline">Profile</a>
      ) : <span className="text-xs text-muted-foreground">—</span>
    case 'companylinkedin':
      return p.companylinkedin ? (
        <a href={p.companylinkedin} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="text-xs text-brand-500 hover:underline">Profile</a>
      ) : <span className="text-xs text-muted-foreground">—</span>
    default: {
      const val = (p as unknown as Record<string, unknown>)[col.key]
      return <span className="text-sm text-muted-foreground truncate">{(val as string) || '—'}</span>
    }
  }
})

// ── Props ──────────────────────────────────────────────────────
interface ProspectsTableProps {
  prospects: Prospect[]
  total: number
  page: number
  pageSize: number
  sortKey: SortKey
  sortDir: SortDir
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  onSort: (key: SortKey, dir: SortDir) => void
  onRowClick: (p: Prospect) => void
  onDelete: (id: string) => void
  onBulkDelete: (ids: string[]) => void
  onBulkStatusChange: (ids: string[], status: Prospect['status']) => void
  isLoading?: boolean
}

// ── Component ──────────────────────────────────────────────────
export function ProspectsTable({
  prospects,
  total,
  page,
  pageSize,
  sortKey,
  sortDir,
  onPageChange,
  onPageSizeChange,
  onSort,
  onRowClick,
  onDelete,
  onBulkDelete,
  onBulkStatusChange,
  isLoading,
}: ProspectsTableProps) {
  // ── View state (persisted) ────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<Set<string>>(loadVisibleCols)
  const [compact, setCompact]         = useState<boolean>(loadCompact)
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)

  // ── Selection ─────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // ── Virtual scroll ────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset selection on page change
  useEffect(() => { setSelected(new Set()) }, [page])

  // Close col picker on outside click
  useEffect(() => {
    if (!colPickerOpen) return
    function onDown(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [colPickerOpen])

  // ── Persistence ───────────────────────────────────────────
  function toggleCol(key: string) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      saveVisibleCols(next)
      return next
    })
  }

  function toggleCompact() {
    setCompact(prev => {
      const next = !prev
      localStorage.setItem(LS_COMPACT, String(next))
      return next
    })
  }

  function resetCols() {
    const next = new Set(DEFAULT_VISIBLE)
    setVisibleCols(next)
    saveVisibleCols(next)
  }

  // ── Sort ──────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortKey === key) onSort(key, sortDir === 'asc' ? 'desc' : 'asc')
    else onSort(key, 'asc')
  }

  // ── Selection helpers ─────────────────────────────────────
  const allPageSelected = prospects.length > 0 && prospects.every(p => selected.has(p.id))
  const someSelected    = selected.size > 0

  function toggleAll() {
    setSelected(prev => {
      const s = new Set(prev)
      if (allPageSelected) prospects.forEach(p => s.delete(p.id))
      else prospects.forEach(p => s.add(p.id))
      return s
    })
  }

  function toggleRow(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const selectedIds = Array.from(selected)

  const handleBulkDelete = useCallback(() => {
    onBulkDelete(selectedIds)
    setSelected(new Set())
  }, [selectedIds, onBulkDelete])

  // ── Derived columns ───────────────────────────────────────
  const activeCols = ALL_COLUMNS.filter(c => visibleCols.has(c.key))
  const colSpanTotal = activeCols.length + 2 // +checkbox +actions

  // ── Padding & styles ──────────────────────────────────────
  const cellPad = compact ? 'px-2 py-1' : 'px-3 py-3'
  const textSz  = compact ? 'text-xs'   : 'text-sm'

  // ── Mobile card view (<768px) ────────────────────────────────
  const mobileCards = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Single scrollable container — avoids competing flex-1 siblings that block touch events */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading…</div>
        )}

        {!isLoading && prospects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No prospects found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}

        {!isLoading && prospects.map(p => (
          <div
            key={p.id}
            onClick={() => onRowClick(p)}
            className={cn(
              'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors',
              selected.has(p.id) && 'bg-brand-50/50 dark:bg-brand-900/10',
            )}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              aria-label={`Select ${p.fullname || 'row'}`}
              checked={selected.has(p.id)}
              onChange={() => toggleRow(p.id)}
              onClick={e => e.stopPropagation()}
              className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-brand-500 cursor-pointer"
            />

            {/* Avatar */}
            <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[11px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
              {(p.firstname?.[0] ?? '').toUpperCase()}{(p.lastname?.[0] ?? '').toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="font-medium text-sm text-foreground truncate">{p.fullname || '—'}</p>
              <p className="text-xs text-muted-foreground truncate">{p.jobtitle || '—'} · {p.company || '—'}</p>
              <p className="text-xs text-muted-foreground truncate">{p.email || '—'}</p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                <StatusBadge status={p.status} />
                <EmailBadge code={p.emailcode} />
                <DispositionBadge code={p.dispositioncode} />
              </div>
            </div>

            {/* 3-dot menu */}
            <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
              <button type="button" aria-label="Row actions"
                onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
              {openMenu === p.id && (
                <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border border-border bg-card shadow-lg py-1">
                  <button type="button" onClick={() => { onRowClick(p); setOpenMenu(null) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> View Details
                  </button>
                  <button type="button" onClick={() => { onDelete(p.id); setOpenMenu(null) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={s => { onPageSizeChange(s); onPageChange(1) }}
      />
    </div>
  )

  return (
    <>
      {/* Mobile (<768px): card list */}
      <div className="flex flex-col flex-1 min-h-0 md:hidden">
        {someSelected && (
          <div className="flex items-center gap-3 px-4 py-2 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200 dark:border-brand-800 shrink-0">
            <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2 ml-2">
              <button type="button" onClick={handleBulkDelete}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-medium transition-colors">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
            <button type="button" onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          </div>
        )}
        {mobileCards}
      </div>

      {/* Tablet+ (≥768px): virtualized table */}
      <div className="hidden md:flex flex-col flex-1 min-h-0">
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Bulk actions bar ─────────────────────────────── */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200 dark:border-brand-800 shrink-0">
          <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            <button type="button" onClick={handleBulkDelete}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-medium transition-colors">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            {(['New','Contacted','Qualified','Closed'] as Prospect['status'][]).map(s => (
              <button key={s} type="button"
                onClick={() => { onBulkStatusChange(selectedIds, s); setSelected(new Set()) }}
                className="h-7 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
                → {s}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear
          </button>
        </div>
      )}

      {/* ── View options bar ─────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-border bg-card shrink-0">

        {/* Column picker */}
        <div className="relative" ref={colPickerRef}>
          <button type="button" onClick={() => setColPickerOpen(v => !v)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors',
              colPickerOpen
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                : 'border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground'
            )}>
            <Columns3 className="h-3.5 w-3.5" />
            Columns
            <span className="h-4 min-w-4 rounded-full bg-muted px-1 text-[10px] font-bold text-muted-foreground flex items-center justify-center">
              {activeCols.length}
            </span>
          </button>

          {colPickerOpen && (
            <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-border bg-card shadow-xl py-2 animate-in fade-in-0 zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-3 pb-1.5 border-b border-border mb-1">
                <span className="text-xs font-semibold text-foreground">Toggle Columns</span>
                <button type="button" onClick={resetCols}
                  className="text-[10px] text-brand-500 hover:text-brand-600 font-medium transition-colors">
                  Reset
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {ALL_COLUMNS.map(col => (
                  <button key={col.key} type="button" onClick={() => toggleCol(col.key)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent transition-colors text-left">
                    <div className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      visibleCols.has(col.key)
                        ? 'bg-brand-500 border-brand-500'
                        : 'border-input bg-background'
                    )}>
                      {visibleCols.has(col.key) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className="text-xs text-foreground">{col.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Compact toggle */}
        <button type="button" onClick={toggleCompact} title={compact ? 'Switch to comfortable view' : 'Switch to compact view'}
          className={cn(
            'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors',
            compact
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
              : 'border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground'
          )}>
          <AlignJustify className="h-3.5 w-3.5" />
          {compact ? 'Compact' : 'Comfortable'}
        </button>
      </div>

      {/* ── Virtualized table ────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 40 }} />
            {activeCols.map(col => (
              <col key={col.key} style={{ minWidth: col.width, width: col.width }} />
            ))}
            <col style={{ width: 40 }} />
          </colgroup>

          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr>
              <th className={cn(cellPad, 'w-10')} aria-label="Select all">
                <input type="checkbox" aria-label="Select all rows"
                  checked={allPageSelected} onChange={toggleAll}
                  className="h-4 w-4 rounded border-input accent-brand-500 cursor-pointer" />
              </th>
              {activeCols.map(col => (
                <th key={col.key}
                  className={cn(cellPad, 'text-left font-semibold text-muted-foreground whitespace-nowrap overflow-hidden')}>
                  {col.sortable ? (
                    <button type="button" onClick={() => toggleSort(col.key as SortKey)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors text-xs">
                      {col.label}
                      {sortKey === col.key
                        ? sortDir === 'asc'
                          ? <ArrowUp   className="h-3 w-3 text-brand-500" />
                          : <ArrowDown className="h-3 w-3 text-brand-500" />
                        : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                      }
                    </button>
                  ) : (
                    <span className="text-xs">{col.label}</span>
                  )}
                </th>
              ))}
              <th className={cn(cellPad, 'w-10')} aria-label="Actions" />
            </tr>
          </thead>

          <tbody>
            {/* Loading skeleton */}
            {isLoading && (
              <tr><td colSpan={colSpanTotal} className="text-center py-16 text-muted-foreground text-sm">Loading…</td></tr>
            )}

            {/* Empty state */}
            {!isLoading && prospects.length === 0 && (
              <tr>
                <td colSpan={colSpanTotal}>
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      <Mail className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-foreground">No prospects found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Rows */}
            {!isLoading && prospects.map(p => (
              <tr
                key={p.id}
                onClick={() => onRowClick(p)}
                className={cn(
                  'border-b border-border cursor-pointer transition-colors hover:bg-accent/50',
                  selected.has(p.id) && 'bg-brand-50/50 dark:bg-brand-900/10'
                )}
              >
                {/* Checkbox */}
                <td className={cn(cellPad)} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${p.fullname || 'row'}`} checked={selected.has(p.id)} onChange={() => toggleRow(p.id)}
                    className="h-4 w-4 rounded border-input accent-brand-500 cursor-pointer" />
                </td>

                {/* Dynamic cells */}
                {activeCols.map(col => (
                  <td key={col.key} className={cn(cellPad, textSz, 'overflow-hidden')}>
                    <CellContent col={col} p={p} compact={compact} />
                  </td>
                ))}

                {/* Row actions */}
                <td className={cn(cellPad)} onClick={e => e.stopPropagation()}>
                  <div className="relative">
                    <button type="button" aria-label="Row actions"
                      onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                      className="h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {openMenu === p.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-border bg-card shadow-lg py-1">
                        <button type="button" onClick={() => { onRowClick(p); setOpenMenu(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" /> View Details
                        </button>
                        <button type="button" onClick={() => { onDelete(p.id); setOpenMenu(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────── */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={s => { onPageSizeChange(s); onPageChange(1) }}
      />
    </div>
    </div>
  </>
  )
}
