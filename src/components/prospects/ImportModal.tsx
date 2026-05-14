import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { X, Upload, FileText, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Prospect } from '@/constants/mockData'

const CHUNK_SIZE = 100

const DB_FIELDS: { key: keyof Prospect; label: string }[] = [
  { key: 'firstname',    label: 'First Name' },
  { key: 'lastname',     label: 'Last Name' },
  { key: 'email',        label: 'Email' },
  { key: 'jobtitle',     label: 'Job Title' },
  { key: 'company',      label: 'Company' },
  { key: 'emailcode',    label: 'Email Code' },
  { key: 'dispositioncode', label: 'Disposition Code' },
  { key: 'providercode', label: 'Provider Code' },
  { key: 'country',      label: 'Country' },
  { key: 'industry',     label: 'Industry' },
  { key: 'employeesize', label: 'Employee Size' },
  { key: 'annualrevenue',label: 'Annual Revenue' },
  { key: 'status',       label: 'Status' },
  { key: 'city',         label: 'City' },
  { key: 'seniority',    label: 'Seniority' },
]

type Step = 'upload' | 'mapping' | 'importing' | 'done'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImported: (prospects: Prospect[]) => void
  userId: string
}

export function ImportModal({ open, onClose, onImported, userId }: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [doneChunks, setDoneChunks] = useState(0)
  const [results, setResults] = useState({ success: 0, failed: 0, errors: [] as string[] })
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload'); setFile(null); setCsvHeaders([]); setMapping({})
    setProgress(0); setTotalChunks(0); setDoneChunks(0)
    setResults({ success: 0, failed: 0, errors: [] })
  }

  function handleClose() { reset(); onClose() }

  function handleFile(f: File) {
    setFile(f)
    Papa.parse(f, {
      header: true,
      preview: 1,
      complete: result => {
        const headers = result.meta.fields ?? []
        setCsvHeaders(headers)
        // Auto-map obvious matches
        const autoMap: Record<string, string> = {}
        headers.forEach(h => {
          const lower = h.toLowerCase().replace(/[^a-z]/g, '')
          const match = DB_FIELDS.find(f =>
            f.key.toLowerCase() === lower ||
            f.label.toLowerCase().replace(/\s/g, '') === lower
          )
          if (match) autoMap[h] = match.key
        })
        setMapping(autoMap)
        setStep('mapping')
      },
    })
  }

  async function startImport() {
    if (!file) return
    setStep('importing')

    const allRows: Record<string, string>[] = await new Promise(resolve => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: r => resolve(r.data as Record<string, string>[]),
      })
    })

    const chunks: Record<string, string>[][] = []
    for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
      chunks.push(allRows.slice(i, i + CHUNK_SIZE))
    }
    setTotalChunks(chunks.length)

    let success = 0
    let failed = 0
    const errors: string[] = []
    const imported: Prospect[] = []

    for (let ci = 0; ci < chunks.length; ci++) {
      for (const row of chunks[ci]) {
        const mapped: Record<string, string> = {}
        Object.entries(mapping).forEach(([csvCol, dbCol]) => {
          if (dbCol) mapped[dbCol] = row[csvCol] ?? ''
        })
        const email = mapped['email']
        if (!email) { failed++; errors.push(`Row missing email`); continue }

        imported.push({
          id: `prs-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fullname: `${mapped['firstname'] ?? ''} ${mapped['lastname'] ?? ''}`.trim(),
          firstname: mapped['firstname'] ?? '',
          lastname: mapped['lastname'] ?? '',
          jobtitle: mapped['jobtitle'] ?? '',
          company: mapped['company'] ?? '',
          website: '',
          personallinkedin: '',
          companylinkedin: '',
          altphonenumber: '0',
          companyphonenumber: '0',
          email,
          emailcode: (mapped['emailcode'] as Prospect['emailcode']) ?? 'EMA003',
          dispositioncode: mapped['dispositioncode'] ?? 'DIS000',
          providercode: mapped['providercode'] ?? 'PRV005',
          status: (mapped['status'] as Prospect['status']) ?? 'New',
          country: mapped['country'] ?? '',
          industry: mapped['industry'] ?? '',
          employeesize: Number(mapped['employeesize']) || 0,
          annualrevenue: Number(mapped['annualrevenue']) || 0,
          createdon: new Date().toISOString(),
          createdby: userId,
          department: '',
          seniority: mapped['seniority'] ?? '',
          city: mapped['city'] ?? '',
          state: '',
          address: '',
          comments: '',
          isactive: true,
        })
        success++
      }
      setDoneChunks(ci + 1)
      setProgress(Math.round(((ci + 1) / chunks.length) * 100))
      // Yield to browser between chunks
      await new Promise(r => setTimeout(r, 10))
    }

    setResults({ success, failed, errors: errors.slice(0, 20) })
    onImported(imported)
    toast.success(`Import complete — ${success} records added`)
    setStep('done')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-foreground">Import CSV</p>
            {file && <span className="text-xs text-muted-foreground">— {file.name}</span>}
          </div>
          <button type="button" onClick={handleClose} className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
                isDragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-border hover:border-brand-400 hover:bg-muted/50'
              )}
            >
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold text-foreground">Drop your CSV here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">Supports up to 100,000 rows</p>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'mapping' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Map your CSV columns to the database fields. Unmapped columns will be skipped.</p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {csvHeaders.map(h => (
                  <div key={h} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground font-medium truncate" title={h}>
                      {h}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                    <select
                      value={mapping[h] ?? ''}
                      onChange={e => setMapping(p => ({ ...p, [h]: e.target.value }))}
                      className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— skip —</option>
                      {DB_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="space-y-5 py-4 text-center">
              <div className="h-14 w-14 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Importing records…</p>
                <p className="text-sm text-muted-foreground">Processing chunk {doneChunks} of {totalChunks}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress}% complete</span>
                  <span>{doneChunks * CHUNK_SIZE} rows processed</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">Import Complete</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {results.success} successful · {results.failed} failed
                  </p>
                </div>
              </div>
              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                    Errors ({results.errors.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-3 space-y-1">
                    {results.errors.map((e, i) => (
                      <p key={i} className="text-xs text-rose-700 dark:text-rose-400">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          {step === 'upload' && (
            <button type="button" onClick={handleClose} className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
          )}
          {step === 'mapping' && (
            <>
              <button type="button" onClick={() => setStep('upload')} className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Back</button>
              <button type="button" onClick={startImport} className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Start Import</button>
            </>
          )}
          {step === 'done' && (
            <button type="button" onClick={handleClose} className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Done</button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}
