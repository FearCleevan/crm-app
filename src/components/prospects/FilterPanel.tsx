import { useState, useMemo } from 'react'
import { X, SlidersHorizontal, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterOptions } from '@/services/prospects.service'

// ── Filter shape ───────────────────────────────────────────────
export interface ProspectFilters {
  status: string[]
  dispositioncode: string[]
  emailcode: string[]
  providercode: string[]
  country: string[]
  industry: string[]
  seniority: string[]
  department: string[]
  city: string[]
  jobtitle: string[]
  company: string[]
  employeesizeMin: string
  employeesizeMax: string
  annualrevenueMin: string
  annualrevenueMax: string
  dateFrom: string
  dateTo: string
}

export const EMPTY_FILTERS: ProspectFilters = {
  status: [], dispositioncode: [], emailcode: [], providercode: [],
  country: [], industry: [], seniority: [], department: [], city: [], jobtitle: [], company: [],
  employeesizeMin: '', employeesizeMax: '',
  annualrevenueMin: '', annualrevenueMax: '',
  dateFrom: '', dateTo: '',
}

const STATUSES = ['New', 'Contacted', 'Qualified', 'Closed']

// ── Pill multi-select (short fixed lists) ──────────────────────
function PillSelect({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => toggle(o.value)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              value.includes(o.value)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Searchable checkbox list (dynamic / long lists) ────────────
function SearchableSelect({ label, options, value, onChange, loading }: {
  label: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (v: string[]) => void
  loading?: boolean
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }
  function toggleAll() {
    if (value.length === options.length) onChange([])
    else onChange(options.map(o => o.value))
  }

  const selectedCount = value.length

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="text-[10px] font-semibold text-brand-500 bg-brand-50 dark:bg-brand-900/20 px-1.5 py-0.5 rounded-full">
              {selectedCount} selected
            </span>
          )}
          {selectedCount > 0 && (
            <button type="button" onClick={() => onChange([])}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-input bg-muted/40">
          <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
          <span className="text-xs text-muted-foreground">Loading…</span>
        </div>
      ) : options.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">No data in database</p>
      ) : (
        <div className="rounded-lg border border-input overflow-hidden bg-background">
          {/* Search input — only shown when list is long enough */}
          {options.length > 5 && (
            <div className="flex items-center gap-2 border-b border-input px-2.5 py-1.5">
              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Select all row */}
          {options.length > 1 && !query && (
            <button type="button" onClick={toggleAll}
              className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-input/50 hover:bg-accent transition-colors text-left">
              <div className={cn(
                'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                value.length === options.length ? 'bg-brand-500 border-brand-500' :
                  value.length > 0 ? 'bg-brand-200 border-brand-400' : 'border-input'
              )}>
                {value.length > 0 && (
                  <div className={cn(
                    'rounded-sm',
                    value.length === options.length ? 'h-2 w-2 bg-white' : 'h-1.5 w-0.5 bg-white mx-auto'
                  )} />
                )}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {value.length === options.length ? 'Deselect all' : 'Select all'}
              </span>
            </button>
          )}

          {/* Options list */}
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2 italic">No matches for "{query}"</p>
            ) : filtered.map(o => (
              <label key={o.value}
                className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent cursor-pointer transition-colors">
                <div className={cn(
                  'h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center transition-colors',
                  value.includes(o.value) ? 'bg-brand-500 border-brand-500' : 'border-input bg-background'
                )}>
                  {value.includes(o.value) && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" className="sr-only"
                  checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
                <span className="text-xs text-foreground truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Range input ────────────────────────────────────────────────
function RangeInput({ label, minKey, maxKey, values, onChange, prefix }: {
  label: string
  minKey: keyof ProspectFilters
  maxKey: keyof ProspectFilters
  values: ProspectFilters
  onChange: (k: keyof ProspectFilters, v: string) => void
  prefix?: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className="flex gap-2 items-center">
        {(['Min', 'Max'] as const).map((side, i) => {
          const key = i === 0 ? minKey : maxKey
          return (
            <div key={side} className="relative flex-1">
              {prefix && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">{prefix}</span>
              )}
              <input
                type="number"
                min={0}
                placeholder={side}
                value={values[key] as string}
                onChange={e => onChange(key, e.target.value)}
                className={cn(
                  'w-full h-8 rounded-lg border border-input bg-background text-xs text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground',
                  prefix ? 'pl-5 pr-2' : 'px-3'
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Filter panel props ─────────────────────────────────────────
interface FilterPanelProps {
  open: boolean
  onClose: () => void
  filters: ProspectFilters
  onApply: (f: ProspectFilters) => void
  options: FilterOptions
  optionsLoading: boolean
}

export function FilterPanel({ open, onClose, filters, onApply, options, optionsLoading }: FilterPanelProps) {
  const [draft, setDraft] = useState<ProspectFilters>(filters)

  // Sync draft when panel reopens with new committed filters
  // (user may have cleared filters outside while panel was closed)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(filters)
  }

  function setField(k: keyof ProspectFilters, v: string) {
    setDraft(p => ({ ...p, [k]: v }))
  }
  function setMulti(k: keyof ProspectFilters, v: string[]) {
    setDraft(p => ({ ...p, [k]: v }))
  }

  function reset() { setDraft(EMPTY_FILTERS) }
  function apply() { onApply(draft); onClose() }

  // Build options for code-based selects
  const dispositionOpts = options.dispositions.map(d => ({
    value: d.disposition_code, label: d.disposition_name,
  }))
  const emailStatusOpts = options.emailStatuses.map(e => ({
    value: e.email_code, label: e.email_name,
  }))
  const providerOpts = options.providers.map(p => ({
    value: p.provider_code, label: p.provider_name,
  }))
  const countryOpts = options.countries.map(c => ({ value: c, label: c }))
  const industryOpts = options.industries.map(i => ({ value: i, label: i }))
  const seniorityOpts = options.seniorities.map(s => ({ value: s, label: s }))
  const departmentOpts = options.departments.map(d => ({ value: d, label: d }))
  const cityOpts = options.cities.map(c => ({ value: c, label: c }))
  const jobtitleOpts = (options.jobtitles ?? []).map(t => ({ value: t, label: t }))
  const companyOpts = (options.companies ?? []).map(c => ({ value: c, label: c }))

  const activeCount = Object.entries(draft).reduce((n, [k, v]) => {
    if (k === 'employeesizeMin' || k === 'employeesizeMax' || k === 'annualrevenueMin' || k === 'annualrevenueMax' || k === 'dateFrom' || k === 'dateTo')
      return n + (v ? 1 : 0)
    return n + (Array.isArray(v) ? v.length : 0)
  }, 0)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      )}

      <div className={cn(
        'fixed z-50 bg-card shadow-2xl flex flex-col transition-transform duration-300',
        // Mobile: full-width bottom sheet sliding up
        'bottom-0 left-0 right-0 h-[90vh] rounded-t-2xl border-t border-border',
        'sm:top-0 sm:bottom-auto sm:left-auto sm:right-0 sm:h-full sm:w-[480px] sm:rounded-none sm:border-t-0 sm:border-l sm:border-border',
        open ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-foreground">Filters</p>
            {activeCount > 0 && (
              <span className="h-5 min-w-5 rounded-full bg-brand-500 text-white text-[10px] font-bold px-1.5 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close filters" title="Close filters"
            className="h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          <PillSelect
            label="Status"
            options={STATUSES.map(s => ({ value: s, label: s }))}
            value={draft.status}
            onChange={v => setMulti('status', v)}
          />

          <SearchableSelect
            label="Disposition"
            options={dispositionOpts}
            value={draft.dispositioncode}
            onChange={v => setMulti('dispositioncode', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Email Status"
            options={emailStatusOpts}
            value={draft.emailcode}
            onChange={v => setMulti('emailcode', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Provider"
            options={providerOpts}
            value={draft.providercode}
            onChange={v => setMulti('providercode', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Job Title"
            options={jobtitleOpts}
            value={draft.jobtitle}
            onChange={v => setMulti('jobtitle', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Company"
            options={companyOpts}
            value={draft.company}
            onChange={v => setMulti('company', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Country"
            options={countryOpts}
            value={draft.country}
            onChange={v => setMulti('country', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Industry"
            options={industryOpts}
            value={draft.industry}
            onChange={v => setMulti('industry', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Seniority"
            options={seniorityOpts}
            value={draft.seniority}
            onChange={v => setMulti('seniority', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="Department"
            options={departmentOpts}
            value={draft.department}
            onChange={v => setMulti('department', v)}
            loading={optionsLoading}
          />

          <SearchableSelect
            label="City"
            options={cityOpts}
            value={draft.city}
            onChange={v => setMulti('city', v)}
            loading={optionsLoading}
          />

          <RangeInput
            label="Employee Size"
            minKey="employeesizeMin"
            maxKey="employeesizeMax"
            values={draft}
            onChange={setField}
          />

          <RangeInput
            label="Annual Revenue"
            minKey="annualrevenueMin"
            maxKey="annualrevenueMax"
            values={draft}
            onChange={setField}
            prefix="$"
          />

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Created Date</p>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <p className="text-[10px] text-muted-foreground">From</p>
                <input type="date" aria-label="Date from" value={draft.dateFrom} onChange={e => setField('dateFrom', e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[10px] text-muted-foreground">To</p>
                <input type="date" aria-label="Date to" value={draft.dateTo} onChange={e => setField('dateTo', e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2 shrink-0">
          <button type="button" onClick={reset}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Clear All
          </button>
          <button type="button" onClick={apply}
            className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Apply Filters
          </button>
        </div>
      </div>
    </>
  )
}

// ── Active filter chips ────────────────────────────────────────
export function FilterChips({ filters, options, onRemove, onClearAll }: {
  filters: ProspectFilters
  options: FilterOptions
  onRemove: (k: keyof ProspectFilters, v?: string) => void
  onClearAll: () => void
}) {
  const chips: { key: keyof ProspectFilters; label: string; value?: string }[] = []

  function addChips(k: keyof ProspectFilters, vals: string[], labelFn: (v: string) => string) {
    vals.forEach(v => chips.push({ key: k, label: labelFn(v), value: v }))
  }

  const dispMap = Object.fromEntries(options.dispositions.map(d => [d.disposition_code, d.disposition_name]))
  const emailMap = Object.fromEntries(options.emailStatuses.map(e => [e.email_code, e.email_name]))
  const provMap = Object.fromEntries(options.providers.map(p => [p.provider_code, p.provider_name]))

  addChips('status', filters.status, v => `Status: ${v}`)
  addChips('dispositioncode', filters.dispositioncode, v => `Disp: ${dispMap[v] ?? v}`)
  addChips('emailcode', filters.emailcode, v => `Email: ${emailMap[v] ?? v}`)
  addChips('providercode', filters.providercode, v => `Provider: ${provMap[v] ?? v}`)
  addChips('country', filters.country, v => `Country: ${v}`)
  addChips('industry', filters.industry, v => `Industry: ${v}`)
  addChips('seniority', filters.seniority, v => `Seniority: ${v}`)
  addChips('department', filters.department, v => `Dept: ${v}`)
  addChips('city', filters.city, v => `City: ${v}`)
  addChips('jobtitle', filters.jobtitle, v => `Job Title: ${v}`)
  addChips('company', filters.company, v => `Company: ${v}`)

  if (filters.employeesizeMin || filters.employeesizeMax)
    chips.push({ key: 'employeesizeMin', label: `Employees: ${filters.employeesizeMin || '0'}–${filters.employeesizeMax || '∞'}` })
  if (filters.annualrevenueMin || filters.annualrevenueMax)
    chips.push({ key: 'annualrevenueMin', label: `Revenue: $${filters.annualrevenueMin || '0'}–$${filters.annualrevenueMax || '∞'}` })
  if (filters.dateFrom || filters.dateTo)
    chips.push({ key: 'dateFrom', label: `Date: ${filters.dateFrom || '…'} – ${filters.dateTo || '…'}` })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <span key={i}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium">
          {c.label}
          <button type="button" onClick={() => onRemove(c.key, c.value)}
            aria-label={`Remove ${c.label}`} title={`Remove ${c.label}`}
            className="hover:text-brand-900 dark:hover:text-brand-100 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
        Clear all
      </button>
    </div>
  )
}
