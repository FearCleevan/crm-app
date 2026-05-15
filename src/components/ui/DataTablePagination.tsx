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
        'h-8 w-8 rounded-md border border-border flex items-center justify-center text-muted-foreground transition-colors',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent hover:text-foreground'
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-3 border-t border-border bg-card">
      {/* Record count */}
      <p className="text-xs text-muted-foreground shrink-0">
        {total === 0 ? 'No records' : `${start}–${end} of ${total.toLocaleString()} records`}
      </p>

      <div className="flex items-center gap-3">
        {/* Page size */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Rows:</span>
          <select
            value={pageSize}
            onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
    </div>
  )
}
