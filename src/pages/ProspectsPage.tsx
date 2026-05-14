import { useState, useMemo, useCallback } from 'react'
import { Search, SlidersHorizontal, UserPlus, Upload, Download, FileDown, X } from 'lucide-react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { useAuth } from '@/context/AuthContext'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ProspectsTable } from '@/components/prospects/ProspectsTable'
import { FilterPanel, FilterChips, EMPTY_FILTERS, type ProspectFilters } from '@/components/prospects/FilterPanel'
import { AddProspectModal } from '@/components/prospects/AddProspectModal'
import { ImportModal } from '@/components/prospects/ImportModal'
import { ProspectDetailSheet } from '@/components/prospects/ProspectDetailSheet'
import { MOCK_PROSPECTS, type Prospect } from '@/constants/mockData'
import { PermissionGate } from '@/components/auth/PermissionGate'

// We store prospects in component state (replaced by Supabase in Backend phase)
function useProspectsState() {
  const [prospects, setProspects] = useState<Prospect[]>(MOCK_PROSPECTS)

  const addProspect = useCallback((p: Prospect) => {
    setProspects(prev => [p, ...prev])
  }, [])

  const addMany = useCallback((ps: Prospect[]) => {
    setProspects(prev => [...ps, ...prev])
  }, [])

  const updateOne = useCallback((updated: Prospect) => {
    setProspects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }, [])

  const deleteOne = useCallback((id: string) => {
    setProspects(prev => prev.filter(p => p.id !== id))
    toast.success('Prospect deleted')
  }, [])

  const bulkDelete = useCallback((ids: string[]) => {
    setProspects(prev => prev.filter(p => !ids.includes(p.id)))
    toast.success(`${ids.length} prospects deleted`)
  }, [])

  const bulkStatusChange = useCallback((ids: string[], status: Prospect['status']) => {
    setProspects(prev => prev.map(p => ids.includes(p.id) ? { ...p, status } : p))
    toast.success(`${ids.length} prospects updated to "${status}"`)
  }, [])

  return { prospects, addProspect, addMany, updateOne, deleteOne, bulkDelete, bulkStatusChange }
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useState(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  })
  return debounced
}

function applyFilters(prospects: Prospect[], search: string, filters: ProspectFilters): Prospect[] {
  let result = prospects

  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(p =>
      p.fullname.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q)
    )
  }

  if (filters.status.length)        result = result.filter(p => filters.status.includes(p.status))
  if (filters.dispositioncode.length) result = result.filter(p => filters.dispositioncode.includes(p.dispositioncode))
  if (filters.emailcode.length)      result = result.filter(p => filters.emailcode.includes(p.emailcode))
  if (filters.providercode.length)   result = result.filter(p => filters.providercode.includes(p.providercode))
  if (filters.country.length)        result = result.filter(p => filters.country.includes(p.country))
  if (filters.industry.length)       result = result.filter(p => filters.industry.includes(p.industry))
  if (filters.seniority.length)      result = result.filter(p => filters.seniority.includes(p.seniority))

  if (filters.employeesizeMin) result = result.filter(p => p.employeesize >= Number(filters.employeesizeMin))
  if (filters.employeesizeMax) result = result.filter(p => p.employeesize <= Number(filters.employeesizeMax))
  if (filters.annualrevenueMin) result = result.filter(p => p.annualrevenue >= Number(filters.annualrevenueMin))
  if (filters.annualrevenueMax) result = result.filter(p => p.annualrevenue <= Number(filters.annualrevenueMax))

  return result
}

function hasActiveFilters(f: ProspectFilters) {
  return Object.values(f).some(v => (Array.isArray(v) ? v.length > 0 : v !== ''))
}

export function ProspectsPage() {
  const { user } = useAuth()
  const { prospects, addProspect, addMany, updateOne, deleteOne, bulkDelete, bulkStatusChange } = useProspectsState()

  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 250)
  const [filters, setFilters] = useState<ProspectFilters>(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [detailProspect, setDetailProspect] = useState<Prospect | null>(null)

  const filtered = useMemo(() => applyFilters(prospects, search, filters), [prospects, search, filters])
  const activeFilterCount = Object.values(filters).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0)

  function removeFilterChip(key: keyof ProspectFilters, value?: string) {
    setFilters(prev => {
      const current = prev[key]
      if (Array.isArray(current) && value) {
        return { ...prev, [key]: current.filter((v: string) => v !== value) }
      }
      return { ...prev, [key]: Array.isArray(current) ? [] : '' }
    })
  }

  function downloadTemplate() {
    const headers = [
      'Full Name', 'First Name', 'Last Name', 'Email', 'Job Title', 'Company', 'Website',
      'Personal LinkedIn', 'Company LinkedIn', 'Alt Phone', 'Company Phone',
      'Status', 'Email Status', 'Disposition', 'Provider Code', 'Country', 'Industry',
      'Employee Size', 'Annual Revenue', 'Department', 'Seniority', 'City', 'State',
      'Address', 'Comments',
    ]
    const sample = [
      'John Smith', 'John', 'Smith', 'john.smith@example.com', 'VP of Sales', 'Acme Corp', 'https://acme.com',
      'https://linkedin.com/in/johnsmith', 'https://linkedin.com/company/acme', '+1 555 0101', '+1 555 0100',
      'New', 'EMA000', 'DIS000', 'PRV000', 'United States', 'Technology',
      '500', '5000000', 'Sales', 'VP', 'San Francisco', 'CA',
      '123 Market St', 'Sample prospect — replace with real data',
    ]
    const csv = Papa.unparse({ fields: headers, data: [sample] })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'prospects-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Template CSV downloaded')
  }

  function exportCSV() {
    const csv = Papa.unparse(filtered.map(p => ({
      'Full Name': p.fullname, 'Email': p.email, 'Job Title': p.jobtitle,
      'Company': p.company, 'Status': p.status, 'Email Status': p.emailcode,
      'Disposition': p.dispositioncode, 'Country': p.country, 'Industry': p.industry,
      'Created': p.createdon,
    })))
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `prospects-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} records`)
  }

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{prospects.length.toLocaleString()} total</span>
        </div>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="px-6 pt-5 pb-3 space-y-3 border-b border-border bg-card">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search name, email, company…"
                className="w-full h-9 pl-9 pr-9 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
              {searchInput && (
                <button type="button" aria-label="Clear search" onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter button */}
            <button type="button" onClick={() => setFilterOpen(true)}
              className="relative flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="h-4 min-w-4 rounded-full bg-brand-500 text-white text-[9px] font-bold px-1 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="ml-auto flex items-center gap-2">
              {/* Download Template */}
              <button type="button" onClick={downloadTemplate}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                <FileDown className="h-4 w-4" />
                Template CSV
              </button>

              {/* Export */}
              <button type="button" onClick={exportCSV}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                <Download className="h-4 w-4" />
                Export
              </button>

              {/* Import */}
              <PermissionGate permission="leads_import">
                <button type="button" onClick={() => setImportOpen(true)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Import CSV
                </button>
              </PermissionGate>

              {/* Add Prospect */}
              <PermissionGate permission="leads_create">
                <button type="button" onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors">
                  <UserPlus className="h-4 w-4" />
                  Add Prospect
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters(filters) && (
            <FilterChips
              filters={filters}
              onRemove={removeFilterChip}
              onClearAll={() => setFilters(EMPTY_FILTERS)}
            />
          )}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ProspectsTable
            prospects={filtered}
            onRowClick={setDetailProspect}
            onDelete={deleteOne}
            onBulkDelete={bulkDelete}
            onBulkStatusChange={bulkStatusChange}
          />
        </div>
      </PageWrapper>

      {/* Panels & Modals */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
      />

      <AddProspectModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addProspect}
        userId={user?.id ?? 'usr-001'}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={addMany}
        userId={user?.id ?? 'usr-001'}
      />

      {detailProspect && (
        <ProspectDetailSheet
          prospect={detailProspect}
          onClose={() => setDetailProspect(null)}
          onUpdate={p => { updateOne(p); setDetailProspect(p) }}
          onDelete={id => { deleteOne(id); setDetailProspect(null) }}
        />
      )}

    </>
  )
}
