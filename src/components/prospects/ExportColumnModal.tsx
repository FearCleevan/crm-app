// src/components/prospects/ExportColumnModal.tsx
import { useState } from 'react'
import { X, Download } from 'lucide-react'
import Papa from 'papaparse'
import type { ProspectRow } from '@/types/database'

export interface ExportColumn {
  key: keyof ProspectRow
  label: string
  defaultSelected: boolean
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'fullname',          label: 'Full Name',        defaultSelected: false },
  { key: 'firstname',         label: 'First Name',       defaultSelected: true  },
  { key: 'lastname',          label: 'Last Name',        defaultSelected: true  },
  { key: 'jobtitle',          label: 'Job Title',        defaultSelected: true  },
  { key: 'company',           label: 'Company',          defaultSelected: true  },
  { key: 'website',           label: 'Website',          defaultSelected: true  },
  { key: 'email',             label: 'Email',            defaultSelected: true  },
  { key: 'altphonenumber',    label: 'Phone',            defaultSelected: false },
  { key: 'companyphonenumber',label: 'Company Phone',    defaultSelected: false },
  { key: 'personallinkedin',  label: 'LinkedIn',         defaultSelected: false },
  { key: 'companylinkedin',   label: 'Company LinkedIn', defaultSelected: false },
  { key: 'address',           label: 'Address',          defaultSelected: false },
  { key: 'street',            label: 'Street',           defaultSelected: false },
  { key: 'city',              label: 'City',             defaultSelected: false },
  { key: 'state',             label: 'State',            defaultSelected: false },
  { key: 'postalcode',        label: 'Postal Code',      defaultSelected: false },
  { key: 'country',           label: 'Country',          defaultSelected: true  },
  { key: 'industry',          label: 'Industry',         defaultSelected: false },
  { key: 'annualrevenue',     label: 'Annual Revenue',   defaultSelected: false },
  { key: 'employeesize',      label: 'Employee Size',    defaultSelected: false },
  { key: 'department',        label: 'Department',       defaultSelected: false },
  { key: 'seniority',         label: 'Seniority',        defaultSelected: false },
]

const PRESETS: { label: string; keys: Array<keyof ProspectRow> }[] = [
  { label: 'All Columns',   keys: EXPORT_COLUMNS.map(c => c.key) },
  { label: 'Contact Info',  keys: ['fullname','email','altphonenumber','company'] },
  { label: 'Outreach',      keys: ['firstname','lastname','email','company','jobtitle','website'] },
  { label: 'Location',      keys: ['fullname','email','city','state','country'] },
]

interface Props {
  prospects: ProspectRow[]
  open: boolean
  onClose: () => void
}

export function ExportColumnModal({ prospects, open, onClose }: Props) {
  const [selected, setSelected] = useState<Set<keyof ProspectRow>>(
    () => new Set(EXPORT_COLUMNS.filter(c => c.defaultSelected).map(c => c.key))
  )
  const [activePreset, setActivePreset] = useState<string | null>(null)

  if (!open) return null

  function toggleCol(key: keyof ProspectRow) {
    setActivePreset(null)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    if (activePreset === preset.label) {
      setActivePreset(null)
      setSelected(new Set(EXPORT_COLUMNS.filter(c => c.defaultSelected).map(c => c.key)))
    } else {
      setActivePreset(preset.label)
      setSelected(new Set(preset.keys))
    }
  }

  function handleExport() {
    const orderedCols = EXPORT_COLUMNS.filter(c => selected.has(c.key))
    const rows = prospects.map(p =>
      Object.fromEntries(orderedCols.map(c => [c.label, p[c.key] ?? '']))
    )
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  const half = Math.ceil(EXPORT_COLUMNS.length / 2)
  const leftCols  = EXPORT_COLUMNS.slice(0, half)
  const rightCols = EXPORT_COLUMNS.slice(half)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export CSV — Select Columns"
        className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onKeyDown={e => e.key === 'Escape' && onClose()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground">Export CSV — Select Columns</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Choose the columns to include in your export</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Presets */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Quick Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`h-7 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    activePreset === preset.label
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-accent'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[leftCols, rightCols].map((cols, gi) => (
              <div key={gi} className="space-y-2">
                {cols.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selected.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                      aria-label={col.label}
                      className="h-3.5 w-3.5 rounded accent-primary"
                    />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          {/* Select/Deselect all */}
          <div className="flex gap-3">
            <button type="button"
              onClick={() => { setActivePreset(null); setSelected(new Set(EXPORT_COLUMNS.map(c => c.key))) }}
              className="text-xs text-primary hover:underline">
              Select All
            </button>
            <button type="button"
              onClick={() => { setActivePreset(null); setSelected(new Set()) }}
              className="text-xs text-muted-foreground hover:underline">
              Deselect All
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          <span className="text-xs text-muted-foreground">
            {selected.size} of {EXPORT_COLUMNS.length} columns selected
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="h-8 px-4 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
