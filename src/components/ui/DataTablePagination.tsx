import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTablePaginationProps {
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 50000, 100000],
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const btn = (label: React.ReactNode, onClick: () => void, disabled: boolean, ariaLabel: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        // 44px touch target on mobile, 32px on tablet+
        'h-11 w-11 md:h-8 md:w-8 rounded-md border border-border flex items-center justify-center text-muted-foreground transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent hover:text-foreground'
      )}
    >
      {label}
    </button>
  )

  const pageControls = (
    <div className="flex items-center gap-3">
      {/* Page size */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Rows:</span>
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
          className="h-9 md:h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {pageSizeOptions.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Nav buttons */}
      <div className="flex items-center gap-1">
        {btn(<ChevronsLeft className="h-3.5 w-3.5" />, () => onPageChange(1), page === 1, 'First page')}
        {btn(<ChevronLeft  className="h-3.5 w-3.5" />, () => onPageChange(page - 1), page === 1, 'Previous page')}
        <span className="text-xs text-muted-foreground px-2">
          {page} / {totalPages}
        </span>
        {btn(<ChevronRight  className="h-3.5 w-3.5" />, () => onPageChange(page + 1), page >= totalPages, 'Next page')}
        {btn(<ChevronsRight className="h-3.5 w-3.5" />, () => onPageChange(totalPages), page >= totalPages, 'Last page')}
      </div>
    </div>
  )

  return (
    <div className="border-t border-border bg-card px-2 py-2">
      {/* Mobile: 2-row stacked layout */}
      <div className="flex flex-col items-center gap-2 md:hidden">
        <p className="text-xs text-muted-foreground">
          {total === 0 ? 'No records' : `${start}–${end} of ${total.toLocaleString()} records`}
        </p>
        {pageControls}
      </div>

      {/* Tablet+: single-row layout */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground shrink-0">
          {total === 0 ? 'No records' : `${start}–${end} of ${total.toLocaleString()} records`}
        </p>
        {pageControls}
      </div>
    </div>
  )
}
