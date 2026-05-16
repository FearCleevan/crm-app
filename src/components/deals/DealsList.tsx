import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CRMUserRow } from '@/types/database'
import type { Deal } from '@/constants/mockData'
import { STAGE_BADGE } from './StageBadge'

type SortKey = 'name' | 'company' | 'value' | 'probability' | 'expectedCloseDate' | 'stage' | 'daysInStage'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sort }: { col: SortKey; sort: { key: SortKey; dir: SortDir } }) {
  if (sort.key !== col) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  return sort.dir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 text-brand-500" />
    : <ChevronDown className="h-3.5 w-3.5 text-brand-500" />
}

interface DealsListProps {
  deals: Deal[]
  users: CRMUserRow[]
  onRowClick: (deal: Deal) => void
  onDelete: (id: string) => void
}

const PAGE_SIZE = 15

export function DealsList({ deals, users, onRowClick, onDelete }: DealsListProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'value', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
    setPage(1)
  }

  const sorted = useMemo(() => [...deals].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1
    const av = a[sort.key], bv = b[sort.key]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
    return String(av).localeCompare(String(bv)) * mul
  }), [deals, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageDeals = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const th = 'px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap'
  const td = 'px-4 py-3 text-sm text-foreground'

  function Th({ label, col }: { label: string; col: SortKey }) {
    return (
      <th className={th}>
        <button type="button" onClick={() => toggleSort(col)}
          className="flex items-center gap-1 hover:text-foreground transition-colors">
          {label} <SortIcon col={col} sort={sort} />
        </button>
      </th>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-card border-b border-border z-10">
            <tr>
              <Th label="Deal Name" col="name" />
              <Th label="Company" col="company" />
              <Th label="Stage" col="stage" />
              <Th label="Value" col="value" />
              <Th label="Prob." col="probability" />
              <Th label="Close Date" col="expectedCloseDate" />
              <Th label="Days in Stage" col="daysInStage" />
              <th className={th}>Assigned</th>
              <th className={cn(th, 'w-12')} />
            </tr>
          </thead>
          <tbody>
            {pageDeals.map(deal => {
              const assignee = users.find(u => u.id === deal.assignedTo)
              const { label, cls } = STAGE_BADGE[deal.stage]
              return (
                <tr key={deal.id}
                  onClick={() => onRowClick(deal)}
                  className="border-b border-border hover:bg-muted/40 cursor-pointer transition-colors group">
                  <td className={cn(td, 'font-medium max-w-[200px]')}>
                    <p className="truncate">{deal.name}</p>
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{deal.company}</td>
                  <td className={td}>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', cls)}>
                      {label}
                    </span>
                  </td>
                  <td className={cn(td, 'font-semibold')}>${deal.value.toLocaleString()}</td>
                  <td className={td}>
                    <span className={cn('font-medium',
                      deal.probability >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
                      deal.probability >= 50 ? 'text-amber-600 dark:text-amber-400' :
                      'text-rose-600 dark:text-rose-400')}>
                      {deal.probability}%
                    </span>
                  </td>
                  <td className={cn(td, 'text-muted-foreground whitespace-nowrap')}>
                    {new Date(deal.expectedCloseDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td className={td}>{deal.daysInStage}d</td>
                  <td className={td}>
                    {assignee && (
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-300 shrink-0">
                          {assignee.first_name[0]}{assignee.last_name[0]}
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">{assignee.first_name}</span>
                      </div>
                    )}
                  </td>
                  <td className={td} onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button type="button" aria-label="Deal actions"
                        onClick={() => setOpenMenu(openMenu === deal.id ? null : deal.id)}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === deal.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                          <div className="absolute right-0 top-8 z-20 w-36 bg-card border border-border rounded-xl shadow-xl overflow-hidden py-1">
                            <button type="button" onClick={() => { onRowClick(deal); setOpenMenu(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                              <Eye className="h-3.5 w-3.5" /> View
                            </button>
                            <button type="button" onClick={() => { onRowClick(deal); setOpenMenu(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <div className="border-t border-border my-1" />
                            <button type="button" onClick={() => { onDelete(deal.id); setOpenMenu(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {pageDeals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <p className="font-medium">No deals found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-between bg-card">
        <span className="text-sm text-muted-foreground">
          {deals.length === 0 ? '0 deals' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="h-7 px-2.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Prev
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i
            return (
              <button key={p} type="button" onClick={() => setPage(p)}
                className={cn('h-7 w-7 rounded-md text-xs font-medium transition-colors',
                  page === p ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-accent')}>
                {p}
              </button>
            )
          })}
          <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="h-7 px-2.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
