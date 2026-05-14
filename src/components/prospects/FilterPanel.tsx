import { useState } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DISPOSITION_CODES, EMAIL_STATUSES, PROVIDERS, INDUSTRIES, COUNTRIES } from '@/constants/mockData'

export interface ProspectFilters {
  status: string[]
  dispositioncode: string[]
  emailcode: string[]
  providercode: string[]
  country: string[]
  industry: string[]
  seniority: string[]
  employeesizeMin: string
  employeesizeMax: string
  annualrevenueMin: string
  annualrevenueMax: string
  dateFrom: string
  dateTo: string
}

export const EMPTY_FILTERS: ProspectFilters = {
  status: [], dispositioncode: [], emailcode: [], providercode: [],
  country: [], industry: [], seniority: [],
  employeesizeMin: '', employeesizeMax: '',
  annualrevenueMin: '', annualrevenueMax: '',
  dateFrom: '', dateTo: '',
}

const STATUSES = ['New', 'Contacted', 'Qualified', 'Closed']
const SENIORITIES = ['C-Level', 'VP', 'Director', 'Manager', 'Senior', 'Mid', 'Junior']

interface FilterPanelProps {
  open: boolean
  onClose: () => void
  filters: ProspectFilters
  onApply: (f: ProspectFilters) => void
}

function MultiSelect({ label, options, value, onChange }: {
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
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              value.includes(o.value)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

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
        <div className="relative flex-1">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
          <input
            type="number"
            placeholder="Min"
            value={values[minKey] as string}
            onChange={e => onChange(minKey, e.target.value)}
            className={cn(
              'w-full h-8 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              prefix ? 'pl-6 pr-2' : 'px-3'
            )}
          />
        </div>
        <span className="text-xs text-muted-foreground">–</span>
        <div className="relative flex-1">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
          <input
            type="number"
            placeholder="Max"
            value={values[maxKey] as string}
            onChange={e => onChange(maxKey, e.target.value)}
            className={cn(
              'w-full h-8 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              prefix ? 'pl-6 pr-2' : 'px-3'
            )}
          />
        </div>
      </div>
    </div>
  )
}

export function FilterPanel({ open, onClose, filters, onApply }: FilterPanelProps) {
  const [draft, setDraft] = useState<ProspectFilters>(filters)

  function setField(k: keyof ProspectFilters, v: string) {
    setDraft(p => ({ ...p, [k]: v }))
  }
  function setMulti(k: keyof ProspectFilters, v: string[]) {
    setDraft(p => ({ ...p, [k]: v }))
  }

  function reset() { setDraft(EMPTY_FILTERS) }
  function apply() { onApply(draft); onClose() }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      )}

      {/* Slide-in panel */}
      <div className={cn(
        'fixed top-0 right-0 h-full z-50 w-80 bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-foreground">Filters</p>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <MultiSelect
            label="Status"
            options={STATUSES.map(s => ({ value: s, label: s }))}
            value={draft.status}
            onChange={v => setMulti('status', v)}
          />
          <MultiSelect
            label="Disposition"
            options={DISPOSITION_CODES.map(d => ({ value: d.code, label: d.name }))}
            value={draft.dispositioncode}
            onChange={v => setMulti('dispositioncode', v)}
          />
          <MultiSelect
            label="Email Status"
            options={EMAIL_STATUSES.map(e => ({ value: e.code, label: e.name }))}
            value={draft.emailcode}
            onChange={v => setMulti('emailcode', v)}
          />
          <MultiSelect
            label="Provider"
            options={PROVIDERS.map(p => ({ value: p.code, label: p.name }))}
            value={draft.providercode}
            onChange={v => setMulti('providercode', v)}
          />
          <MultiSelect
            label="Country"
            options={COUNTRIES.map(c => ({ value: c, label: c }))}
            value={draft.country}
            onChange={v => setMulti('country', v)}
          />
          <MultiSelect
            label="Industry"
            options={INDUSTRIES.map(i => ({ value: i, label: i }))}
            value={draft.industry}
            onChange={v => setMulti('industry', v)}
          />
          <MultiSelect
            label="Seniority"
            options={SENIORITIES.map(s => ({ value: s, label: s }))}
            value={draft.seniority}
            onChange={v => setMulti('seniority', v)}
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
              <input type="date" value={draft.dateFrom} onChange={e => setField('dateFrom', e.target.value)}
                className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <input type="date" value={draft.dateTo} onChange={e => setField('dateTo', e.target.value)}
                className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2">
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

// ── Active filter chips ───────────────────────────────────────
export function FilterChips({ filters, onRemove, onClearAll }: {
  filters: ProspectFilters
  onRemove: (k: keyof ProspectFilters, v?: string) => void
  onClearAll: () => void
}) {
  const chips: { key: keyof ProspectFilters; label: string; value?: string }[] = []

  const addChips = (k: keyof ProspectFilters, vals: string[], labelFn: (v: string) => string) =>
    vals.forEach(v => chips.push({ key: k, label: labelFn(v), value: v }))

  addChips('status', filters.status, v => `Status: ${v}`)
  addChips('dispositioncode', filters.dispositioncode, v => {
    const found = DISPOSITION_CODES.find(d => d.code === v)
    return `Disp: ${found?.name ?? v}`
  })
  addChips('emailcode', filters.emailcode, v => {
    const found = EMAIL_STATUSES.find(e => e.code === v)
    return `Email: ${found?.name ?? v}`
  })
  addChips('providercode', filters.providercode, v => {
    const found = PROVIDERS.find(p => p.code === v)
    return `Provider: ${found?.name ?? v}`
  })
  addChips('country',  filters.country,  v => `Country: ${v}`)
  addChips('industry', filters.industry, v => `Industry: ${v}`)
  addChips('seniority', filters.seniority, v => `Seniority: ${v}`)

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
        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium">
          {c.label}
          <button type="button" onClick={() => onRemove(c.key, c.value)} className="hover:text-brand-900 dark:hover:text-brand-100 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
        Clear all
      </button>
    </div>
  )
}
