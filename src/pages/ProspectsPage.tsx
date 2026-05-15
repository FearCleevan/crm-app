import { useState, useMemo, useCallback, useEffect } from 'react'
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
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useProspects } from '@/hooks/useProspects'
import { useFilterOptions } from '@/hooks/useFilterOptions'
import { prospectsService } from '@/services/prospects.service'
import { rateLimiter } from '@/services/rateLimiter.service'
import type { ProspectRow, ProspectInsert, ProspectUpdate } from '@/types/database'
import type { Prospect } from '@/constants/mockData'
import type { ProspectFormValues } from '@/components/prospects/ProspectForm'

// ── Adapters ──────────────────────────────────────────────────
function rowToProspect(row: ProspectRow): Prospect {
  return {
    id:               String(row.id),
    fullname:         row.fullname ?? '',
    firstname:        row.firstname ?? '',
    lastname:         row.lastname ?? '',
    jobtitle:         row.jobtitle ?? '',
    company:          row.company ?? '',
    website:          row.website ?? '',
    personallinkedin: row.personallinkedin ?? '',
    companylinkedin:  row.companylinkedin ?? '',
    altphonenumber:   row.altphonenumber,
    companyphonenumber: row.companyphonenumber,
    email:            row.email ?? '',
    emailcode:        (row.emailcode as Prospect['emailcode']) ?? 'EMA000',
    dispositioncode:  row.dispositioncode ?? '',
    providercode:     row.providercode ?? '',
    status:           row.status,
    country:          row.country ?? '',
    industry:         row.industry ?? '',
    employeesize:     row.employeesize,
    annualrevenue:    row.annualrevenue,
    createdon:        row.created_on,
    createdby:        row.created_by ?? '',
    department:       row.department ?? '',
    seniority:        row.seniority ?? '',
    address:          row.address ?? '',
    street:           row.street ?? '',
    city:             row.city ?? '',
    state:            row.state ?? '',
    postalcode:       row.postalcode ?? '',
    comments:         row.comments ?? '',
    isactive:         row.isactive,
  }
}

function formToInsert(values: ProspectFormValues, userId: string): ProspectInsert {
  return {
    firstname:          values.firstname,
    lastname:           values.lastname,
    fullname:           `${values.firstname} ${values.lastname}`.trim(),
    jobtitle:           values.jobtitle ?? '',
    company:            values.company,
    email:              values.email,
    emailcode:          values.emailcode ?? null,
    dispositioncode:    values.dispositioncode ?? null,
    providercode:       values.providercode ?? null,
    status:             values.status,
    website:            values.website ?? null,
    personallinkedin:   values.personallinkedin ?? null,
    companylinkedin:    values.companylinkedin ?? null,
    altphonenumber:     values.altphonenumber ?? '',
    companyphonenumber: values.companyphonenumber ?? '',
    address:            values.address ?? null,
    street:             values.street ?? null,
    city:               values.city ?? null,
    state:              values.state ?? null,
    postalcode:         values.postalcode ?? null,
    country:            values.country ?? null,
    annualrevenue:      values.annualrevenue ?? 0,
    industry:           values.industry ?? null,
    employeesize:       values.employeesize ?? 0,
    siccode:            0,
    naicscode:          0,
    comments:           values.comments ?? null,
    isactive:           true,
    department:         values.department ?? null,
    seniority:          values.seniority ?? null,
    created_by:         userId,
    updated_by:         null,
  }
}

function formToUpdate(values: ProspectFormValues, userId: string): ProspectUpdate {
  return {
    firstname:          values.firstname,
    lastname:           values.lastname,
    fullname:           `${values.firstname} ${values.lastname}`.trim(),
    jobtitle:           values.jobtitle ?? '',
    company:            values.company,
    email:              values.email,
    emailcode:          values.emailcode ?? null,
    dispositioncode:    values.dispositioncode ?? null,
    providercode:       values.providercode ?? null,
    status:             values.status,
    website:            values.website ?? null,
    personallinkedin:   values.personallinkedin ?? null,
    companylinkedin:    values.companylinkedin ?? null,
    altphonenumber:     values.altphonenumber ?? '',
    companyphonenumber: values.companyphonenumber ?? '',
    address:            values.address ?? null,
    street:             values.street ?? null,
    city:               values.city ?? null,
    state:              values.state ?? null,
    postalcode:         values.postalcode ?? null,
    country:            values.country ?? null,
    annualrevenue:      values.annualrevenue ?? 0,
    industry:           values.industry ?? null,
    employeesize:       values.employeesize ?? 0,
    comments:           values.comments ?? null,
    department:         values.department ?? null,
    seniority:          values.seniority ?? null,
    updated_by:         userId,
  }
}

// ── Filter conversion ─────────────────────────────────────────
function uiFiltersToService(f: ProspectFilters) {
  return {
    status:           f.status.length          ? f.status          : undefined,
    dispositioncode:  f.dispositioncode.length ? f.dispositioncode : undefined,
    emailcode:        f.emailcode.length       ? f.emailcode       : undefined,
    providercode:     f.providercode.length    ? f.providercode    : undefined,
    country:          f.country.length         ? f.country         : undefined,
    industry:         f.industry.length        ? f.industry        : undefined,
    seniority:        f.seniority.length       ? f.seniority       : undefined,
    department:       f.department.length      ? f.department      : undefined,
    city:             f.city.length            ? f.city            : undefined,
    employeesizeMin:  f.employeesizeMin  ? Number(f.employeesizeMin)  : undefined,
    employeesizeMax:  f.employeesizeMax  ? Number(f.employeesizeMax)  : undefined,
    annualrevenueMin: f.annualrevenueMin ? Number(f.annualrevenueMin) : undefined,
    annualrevenueMax: f.annualrevenueMax ? Number(f.annualrevenueMax) : undefined,
    dateFrom:         f.dateFrom || undefined,
    dateTo:           f.dateTo   || undefined,
  }
}

const SORT_KEY_MAP: Record<string, string> = {
  createdon: 'created_on',
  createdby: 'created_by',
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function hasActiveFilters(f: ProspectFilters) {
  return Object.values(f).some(v => (Array.isArray(v) ? v.length > 0 : v !== ''))
}

export function ProspectsPage() {
  const { user } = useAuth()
  const { options: filterOptions, loading: filterOptionsLoading } = useFilterOptions()

  // ── Pagination & sort (server-side) ───────────────────────
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortKey, setSortKey]   = useState<keyof Prospect>('createdon')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')

  // ── Search & filters ──────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 250)
  const [filters, setFilters] = useState<ProspectFilters>(EMPTY_FILTERS)

  const serviceFilters = useMemo(() => uiFiltersToService(filters), [filters])

  const { data, total, loading, refetch, create, update, remove, bulkRemove, bulkUpdateStatus } =
    useProspects({
      page,
      limit: pageSize,
      search,
      filters: serviceFilters,
      sort: { column: SORT_KEY_MAP[sortKey as string] ?? sortKey, ascending: sortDir === 'asc' },
    })

  const prospects = useMemo(() => data.map(rowToProspect), [data])

  // ── UI state ──────────────────────────────────────────────
  const [filterOpen, setFilterOpen]     = useState(false)
  const [addOpen, setAddOpen]           = useState(false)
  const [importOpen, setImportOpen]     = useState(false)
  const [detailRow, setDetailRow]       = useState<ProspectRow | null>(null)

  const detailProspect = detailRow ? rowToProspect(detailRow) : null

  const activeFilterCount = Object.values(filters).reduce<number>(
    (n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0
  )

  // ── Handlers ──────────────────────────────────────────────
  function handleSort(key: keyof Prospect, dir: 'asc' | 'desc') {
    setSortKey(key); setSortDir(dir); setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearchInput(value); setPage(1)
  }

  function handleApplyFilters(f: ProspectFilters) {
    setFilters(f); setPage(1)
  }

  function removeFilterChip(key: keyof ProspectFilters, value?: string) {
    setFilters(prev => {
      const current = prev[key]
      if (Array.isArray(current) && value) {
        return { ...prev, [key]: current.filter((v: string) => v !== value) }
      }
      return { ...prev, [key]: Array.isArray(current) ? [] : '' }
    })
    setPage(1)
  }

  const handleAdd = useCallback(async (values: ProspectFormValues) => {
    const { allowed } = await rateLimiter.check(user?.id ?? 'anon', 'add_prospect')
    if (!allowed) return
    const created = await create(formToInsert(values, user?.id ?? ''))
    toast.success(`${created.fullname ?? 'Prospect'} added successfully`)
  }, [create, user])

  const handleMergeFromAdd = useCallback(async (existingId: number, values: ProspectFormValues) => {
    const existing = await prospectsService.getProspect(existingId)
    const b = <T,>(e: T, i: T): T => (e !== null && e !== undefined && e !== '' && e !== 0 ? e : i)
    const mergedUpdate: ProspectUpdate = {
      firstname:          b(existing.firstname,        values.firstname),
      lastname:           b(existing.lastname,         values.lastname),
      fullname:           b(existing.fullname,         `${values.firstname} ${values.lastname}`.trim()),
      jobtitle:           b(existing.jobtitle,         values.jobtitle ?? ''),
      company:            b(existing.company,          values.company),
      email:              b(existing.email,            values.email),
      emailcode:          b(existing.emailcode,        values.emailcode ?? null),
      dispositioncode:    b(existing.dispositioncode,  values.dispositioncode ?? null),
      providercode:       b(existing.providercode,     values.providercode ?? null),
      status:             b(existing.status,           values.status),
      website:            b(existing.website,          values.website ?? null),
      personallinkedin:   b(existing.personallinkedin, values.personallinkedin ?? null),
      companylinkedin:    b(existing.companylinkedin,  values.companylinkedin ?? null),
      altphonenumber:     b(existing.altphonenumber,   values.altphonenumber ?? ''),
      companyphonenumber: b(existing.companyphonenumber, values.companyphonenumber ?? ''),
      address:            b(existing.address,          values.address ?? null),
      street:             b(existing.street,           values.street ?? null),
      city:               b(existing.city,             values.city ?? null),
      state:              b(existing.state,            values.state ?? null),
      postalcode:         b(existing.postalcode,       values.postalcode ?? null),
      country:            b(existing.country,          values.country ?? null),
      annualrevenue:      b(existing.annualrevenue,    values.annualrevenue ?? 0),
      industry:           b(existing.industry,         values.industry ?? null),
      employeesize:       b(existing.employeesize,     values.employeesize ?? 0),
      comments:           b(existing.comments,         values.comments ?? null),
      department:         b(existing.department,       values.department ?? null),
      seniority:          b(existing.seniority,        values.seniority ?? null),
      updated_by:         user?.id ?? null,
    }
    await update(existingId, mergedUpdate)
    toast.success(`Merged into ${existing.fullname ?? 'existing prospect'} successfully`)
  }, [update, user])

  const handleDelete = useCallback(async (id: string) => {
    await remove(Number(id))
    toast.success('Prospect deleted')
  }, [remove])

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    const { allowed } = await rateLimiter.check(user?.id ?? 'anon', 'bulk_delete')
    if (!allowed) return
    await bulkRemove(ids.map(Number))
    toast.success(`${ids.length} prospects deleted`)
  }, [bulkRemove, user])

  const handleBulkStatusChange = useCallback(async (ids: string[], status: Prospect['status']) => {
    await bulkUpdateStatus(ids.map(Number), status)
    toast.success(`${ids.length} prospects updated to "${status}"`)
  }, [bulkUpdateStatus])

  const handleDetailUpdate = useCallback(async (values: ProspectFormValues) => {
    if (!detailRow) return
    const updated = await update(detailRow.id, formToUpdate(values, user?.id ?? ''))
    setDetailRow(updated)
    toast.success('Prospect updated')
  }, [detailRow, update, user])

  const handleDetailDelete = useCallback(async () => {
    if (!detailRow) return
    await remove(detailRow.id)
    toast.success(`${detailRow.fullname ?? 'Prospect'} deleted`)
    setDetailRow(null)
  }, [detailRow, remove])

  // ── Export ────────────────────────────────────────────────
  // Exact company column order
  const CSV_HEADERS = [
    'Fullname','Firstname','Lastname','Jobtitle','Company','Website',
    'Personallinkedin','Companylinkedin','Altphonenumber','Companyphonenumber',
    'Email','Emailcode','Address','Street','City','State','Postalcode','Country',
    'Annualrevenue','Industry','Employeesize','Siccode','Naicscode',
    'Dispositioncode','Providercode','Comments','Department','Seniority','Status','CreatedOn',
  ]

  async function exportCSV() {
    const { allowed } = await rateLimiter.check(user?.id ?? 'anon', 'export')
    if (!allowed) return
    try {
      const rows = await prospectsService.exportProspects(serviceFilters, search)
      const csv = Papa.unparse(rows.map(p => ({
        Fullname:         p.fullname ?? '',
        Firstname:        p.firstname ?? '',
        Lastname:         p.lastname ?? '',
        Jobtitle:         p.jobtitle ?? '',
        Company:          p.company ?? '',
        Website:          p.website ?? '',
        Personallinkedin: p.personallinkedin ?? '',
        Companylinkedin:  p.companylinkedin ?? '',
        Altphonenumber:   p.altphonenumber,
        Companyphonenumber: p.companyphonenumber,
        Email:            p.email ?? '',
        Emailcode:        p.emailcode ?? '',
        Address:          p.address ?? '',
        Street:           p.street ?? '',
        City:             p.city ?? '',
        State:            p.state ?? '',
        Postalcode:       p.postalcode ?? '',
        Country:          p.country ?? '',
        Annualrevenue:    p.annualrevenue,
        Industry:         p.industry ?? '',
        Employeesize:     p.employeesize,
        Siccode:          p.siccode,
        Naicscode:        p.naicscode,
        Dispositioncode:  p.dispositioncode ?? '',
        Providercode:     p.providercode ?? '',
        Comments:         p.comments ?? '',
        Department:       p.department ?? '',
        Seniority:        p.seniority ?? '',
        Status:           p.status,
        CreatedOn:        p.created_on,
      })))
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `prospects-${Date.now()}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${rows.length} records`)
    } catch {
      toast.error('Export failed')
    }
  }

  function downloadTemplate() {
    const sample = [[
      'John Smith','John','Smith','VP of Sales','Acme Corp','acme.com',
      'https://linkedin.com/in/johnsmith','https://linkedin.com/company/acme',
      '601.555.1234','210.555.1234',
      'john.smith@acme.com','',
      '123 Market St, San Francisco, CA, United States','123 Market St',
      'San Francisco','California','94105','United States',
      '5000000','Technology','500','0','0',
      '','','','Sales','VP','New',new Date().toISOString(),
    ]]
    const csv = Papa.unparse({ fields: CSV_HEADERS, data: sample })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'prospects-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Template CSV downloaded')
  }

  return (
    <>
      <TopbarSlot>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{total.toLocaleString()} total</span>
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
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search name, email, company…"
                className="w-full h-9 pl-9 pr-9 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
              {searchInput && (
                <button type="button" aria-label="Clear search" onClick={() => handleSearchChange('')}
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
              <button type="button" onClick={downloadTemplate}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                <FileDown className="h-4 w-4" />
                Template CSV
              </button>

              <button type="button" onClick={exportCSV}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                <Download className="h-4 w-4" />
                Export
              </button>

              <PermissionGate permission="leads_import">
                <button type="button" onClick={() => setImportOpen(true)}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors">
                  <Upload className="h-4 w-4" />
                  Import CSV
                </button>
              </PermissionGate>

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
              options={filterOptions}
              onRemove={removeFilterChip}
              onClearAll={() => { setFilters(EMPTY_FILTERS); setPage(1) }}
            />
          )}
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ProspectsTable
            prospects={prospects}
            total={total}
            page={page}
            pageSize={pageSize}
            sortKey={sortKey}
            sortDir={sortDir}
            onPageChange={setPage}
            onPageSizeChange={s => { setPageSize(s); setPage(1) }}
            onSort={handleSort}
            onRowClick={p => {
              const row = data.find(r => r.id === Number(p.id))
              if (row) setDetailRow(row)
            }}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onBulkStatusChange={handleBulkStatusChange}
            isLoading={loading}
          />
        </div>
      </PageWrapper>

      {/* Panels & Modals */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={handleApplyFilters}
        options={filterOptions}
        optionsLoading={filterOptionsLoading}
      />

      <AddProspectModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
        onMerge={handleMergeFromAdd}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refetch}
        userId={user?.id ?? ''}
      />

      {detailProspect && detailRow && (
        <ProspectDetailSheet
          prospect={detailProspect}
          onClose={() => setDetailRow(null)}
          onUpdate={handleDetailUpdate}
          onDelete={handleDetailDelete}
        />
      )}
    </>
  )
}
