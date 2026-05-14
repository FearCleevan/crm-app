import { useState, useMemo, useCallback } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Trash2, Mail, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { StatusBadge, EmailBadge, DispositionBadge } from './ProspectBadges'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import type { Prospect } from '@/constants/mockData'
import { PROVIDERS } from '@/constants/mockData'

type SortKey = keyof Prospect
type SortDir = 'asc' | 'desc'

interface ProspectsTableProps {
  prospects: Prospect[]
  onRowClick: (p: Prospect) => void
  onDelete: (id: string) => void
  onBulkDelete: (ids: string[]) => void
  onBulkStatusChange: (ids: string[], status: Prospect['status']) => void
  isLoading?: boolean
}

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: string; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return sortDir === 'asc'
    ? <ArrowUp   className="h-3.5 w-3.5 text-brand-500" />
    : <ArrowDown className="h-3.5 w-3.5 text-brand-500" />
}

function providerName(code: string) {
  return PROVIDERS.find(p => p.code === code)?.name ?? code
}

export function ProspectsTable({
  prospects,
  onRowClick,
  onDelete,
  onBulkDelete,
  onBulkStatusChange,
  isLoading,
}: ProspectsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('createdon')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Sort
  const sorted = useMemo(() => {
    return [...prospects].sort((a, b) => {
      const av = a[sortKey] as string | number
      const bv = b[sortKey] as string | number
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [prospects, sortKey, sortDir])

  // Paginate
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Selection
  const allPageSelected = paginated.length > 0 && paginated.every(p => selected.has(p.id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allPageSelected) {
      setSelected(prev => { const s = new Set(prev); paginated.forEach(p => s.delete(p.id)); return s })
    } else {
      setSelected(prev => { const s = new Set(prev); paginated.forEach(p => s.add(p.id)); return s })
    }
  }

  function toggleRow(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const selectedIds = Array.from(selected)

  const handleBulkDelete = useCallback(() => {
    onBulkDelete(selectedIds)
    setSelected(new Set())
  }, [selectedIds, onBulkDelete])

  function ThCol({ label, sortable, col, className }: { label: string; sortable?: boolean; col?: SortKey; className?: string }) {
    return (
      <th className={cn('px-3 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap', className)}>
        {sortable && col ? (
          <button type="button" onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors">
            {label} <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
          </button>
        ) : label}
      </th>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Bulk actions toolbar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200 dark:border-brand-800">
          <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            <button type="button" onClick={handleBulkDelete}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-medium transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            {(['New','Contacted','Qualified','Closed'] as Prospect['status'][]).map(s => (
              <button key={s} type="button"
                onClick={() => { onBulkStatusChange(selectedIds, s); setSelected(new Set()) }}
                className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium text-foreground transition-colors">
                → {s}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr>
              <th className="px-3 py-3 w-10">
                <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                  className="h-4 w-4 rounded border-input accent-brand-500 cursor-pointer" />
              </th>
              <ThCol label="Full Name"   sortable col="fullname"   className="min-w-[160px]" />
              <ThCol label="Job Title"   sortable col="jobtitle"   className="min-w-[140px]" />
              <ThCol label="Company"     sortable col="company"    className="min-w-[140px]" />
              <ThCol label="Email"       sortable col="email"      className="min-w-[200px]" />
              <ThCol label="Email Status"                          className="min-w-[100px]" />
              <ThCol label="Disposition"                           className="min-w-[120px]" />
              <ThCol label="Provider"                              className="min-w-[90px]" />
              <ThCol label="Status"      sortable col="status"     className="min-w-[100px]" />
              <ThCol label="Created"     sortable col="createdon"  className="min-w-[100px]" />
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={11} className="text-center py-16 text-muted-foreground text-sm">Loading…</td></tr>
            )}
            {!isLoading && paginated.length === 0 && (
              <tr>
                <td colSpan={11}>
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
            {!isLoading && paginated.map(p => (
              <tr
                key={p.id}
                onClick={() => onRowClick(p)}
                className={cn(
                  'border-b border-border cursor-pointer transition-colors hover:bg-accent/50',
                  selected.has(p.id) && 'bg-brand-50/50 dark:bg-brand-900/10'
                )}
              >
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleRow(p.id)}
                    className="h-4 w-4 rounded border-input accent-brand-500 cursor-pointer" />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[10px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                      {(p.firstname[0] ?? '').toUpperCase()}{(p.lastname[0] ?? '').toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground truncate max-w-[120px]">{p.fullname}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-muted-foreground truncate max-w-[130px]">{p.jobtitle}</td>
                <td className="px-3 py-3 font-medium text-foreground truncate max-w-[130px]">{p.company}</td>
                <td className="px-3 py-3 text-muted-foreground truncate max-w-[180px]">
                  <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()} className="hover:text-brand-500 transition-colors flex items-center gap-1">
                    <Mail className="h-3 w-3 shrink-0" />{p.email}
                  </a>
                </td>
                <td className="px-3 py-3"><EmailBadge code={p.emailcode} /></td>
                <td className="px-3 py-3"><DispositionBadge code={p.dispositioncode} /></td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{providerName(p.providercode)}</td>
                <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(p.createdon), 'MMM d, yyyy')}
                </td>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <div className="relative">
                    <button type="button"
                      onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                      className="h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {openMenu === p.id && (
                      <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-border bg-card shadow-lg py-1">
                        <button type="button" onClick={() => { onRowClick(p); setOpenMenu(null) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" /> View Details
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

      {/* Pagination */}
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={sorted.length}
        onPageChange={p => { setPage(p); setSelected(new Set()) }}
        onPageSizeChange={s => { setPageSize(s); setPage(1) }}
      />
    </div>
  )
}
