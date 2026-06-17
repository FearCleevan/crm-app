import { useState } from 'react'
import { Search, Check } from 'lucide-react'
import { useProspects } from '@/hooks/useProspects'
import { useProspectSelection } from '@/hooks/useProspectSelection'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import { cn } from '@/lib/utils'

interface Props {
  onConfirm: (ids: number[]) => void
  onCancel: () => void
}

const PAGE_SIZE = 25

export function ProspectSelector({ onConfirm, onCancel: _onCancel }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [search, setSearch] = useState('')
  const { data, total, loading } = useProspects({ page, limit: pageSize, search, filters: { isactive: true } })
  const { selectedIds, toggle, clear, isSelected, count } = useProspectSelection()

  const withEmail = data.filter(p => p.email)

  function handleSelectAllPage() {
    const pageIds = withEmail.map(p => p.id)
    const allSelected = pageIds.every(id => isSelected(id))
    if (allSelected) {
      pageIds.forEach(toggle)
    } else {
      pageIds.forEach(id => { if (!isSelected(id)) toggle(id) })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name, email, company…"
            className="w-full h-8 pl-8 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="w-10 pl-4 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={withEmail.length > 0 && withEmail.every(p => isSelected(p.id))}
                  onChange={handleSelectAllPage}
                  className="h-3.5 w-3.5 accent-primary"
                />
              </th>
              {['Full Name', 'Job Title', 'Company', 'Email', 'Country', 'Status'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-muted-foreground py-2 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="py-2 px-4">
                    <div className="h-7 rounded bg-muted/40 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : withEmail.map(p => (
              <tr
                key={p.id}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer',
                  isSelected(p.id) && 'bg-brand-50/50 dark:bg-brand-900/10'
                )}
                onClick={() => toggle(p.id)}
              >
                <td className="pl-4 py-2">
                  <div className={cn(
                    'h-4 w-4 rounded border-2 flex items-center justify-center transition-colors',
                    isSelected(p.id) ? 'bg-primary border-primary' : 'border-border'
                  )}>
                    {isSelected(p.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </td>
                <td className="py-2 pr-4 font-medium text-foreground whitespace-nowrap">
                  {p.fullname ?? (`${p.firstname ?? ''} ${p.lastname ?? ''}`.trim() || '—')}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">{p.jobtitle ?? '—'}</td>
                <td className="py-2 pr-4 text-muted-foreground">{p.company ?? '—'}</td>
                <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{p.email}</td>
                <td className="py-2 pr-4 text-muted-foreground">{p.country ?? '—'}</td>
                <td className="py-2 pr-4">
                  <span className="text-xs text-muted-foreground capitalize">{p.status ?? '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="shrink-0">
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(1) }}
        />
      </div>

      {count > 0 && (
        <div className="border-t border-border px-4 py-3 bg-brand-50 dark:bg-brand-900/20 flex items-center justify-between shrink-0">
          <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
            {count} prospect{count !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clear}
              className="h-7 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onConfirm([...selectedIds])}
              className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Confirm Selection →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
