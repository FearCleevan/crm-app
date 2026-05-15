import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { X, Upload, FileText, CheckCircle2, AlertCircle, ChevronDown, GitMerge, SkipForward, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { prospectsService } from '@/services/prospects.service'
import { importService } from '@/services/import.service'
import { rateLimiter } from '@/services/rateLimiter.service'
import type { ProspectInsert, ProspectRow } from '@/types/database'

const CHUNK_SIZE = 100

// ── Duplicate handling mode ────────────────────────────────────
type DupMode = 'merge' | 'overwrite' | 'skip'

const DUP_MODES: { value: DupMode; icon: React.ReactNode; label: string; desc: string }[] = [
  {
    value: 'merge',
    icon: <GitMerge className="h-3.5 w-3.5" />,
    label: 'Merge',
    desc: 'Keep existing data — only fill in blank fields from the import row.',
  },
  {
    value: 'overwrite',
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    label: 'Overwrite',
    desc: 'Replace all fields in the existing record with the imported values.',
  },
  {
    value: 'skip',
    icon: <SkipForward className="h-3.5 w-3.5" />,
    label: 'Skip',
    desc: 'Leave existing records untouched and discard the duplicate row.',
  },
]

const DB_FIELDS: { key: string; label: string }[] = [
  { key: 'fullname',          label: 'Fullname' },
  { key: 'firstname',         label: 'Firstname' },
  { key: 'lastname',          label: 'Lastname' },
  { key: 'jobtitle',          label: 'Jobtitle' },
  { key: 'company',           label: 'Company' },
  { key: 'website',           label: 'Website' },
  { key: 'personallinkedin',  label: 'Personallinkedin' },
  { key: 'companylinkedin',   label: 'Companylinkedin' },
  { key: 'altphonenumber',    label: 'Altphonenumber' },
  { key: 'companyphonenumber',label: 'Companyphonenumber' },
  { key: 'email',             label: 'Email' },
  { key: 'emailcode',         label: 'Emailcode' },
  { key: 'address',           label: 'Address' },
  { key: 'street',            label: 'Street' },
  { key: 'city',              label: 'City' },
  { key: 'state',             label: 'State' },
  { key: 'postalcode',        label: 'Postalcode' },
  { key: 'country',           label: 'Country' },
  { key: 'annualrevenue',     label: 'Annualrevenue' },
  { key: 'industry',          label: 'Industry' },
  { key: 'employeesize',      label: 'Employeesize' },
  { key: 'siccode',           label: 'Siccode' },
  { key: 'naicscode',         label: 'Naicscode' },
  { key: 'dispositioncode',   label: 'Dispositioncode' },
  { key: 'providercode',      label: 'Providercode' },
  { key: 'comments',          label: 'Comments' },
  { key: 'department',        label: 'Department' },
  { key: 'seniority',         label: 'Seniority' },
  { key: 'status',            label: 'Status' },
]

type Step = 'upload' | 'mapping' | 'importing' | 'done'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
  userId: string
}

// ── Merge helper ───────────────────────────────────────────────
// Picks the best value: existing wins if non-null/empty/zero, else incoming
function best<T>(existing: T | null | undefined, incoming: T | null | undefined): T | null {
  const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || v === 0
  return isEmpty(existing) ? (incoming ?? null) : (existing as T)
}

function buildMerge(existing: ProspectRow, incoming: ProspectInsert): Partial<ProspectRow> & { id: number } {
  return {
    id:                existing.id,
    fullname:          best(existing.fullname,           incoming.fullname)           ?? '',
    firstname:         best(existing.firstname,          incoming.firstname)          ?? '',
    lastname:          best(existing.lastname,           incoming.lastname)           ?? '',
    jobtitle:          best(existing.jobtitle,           incoming.jobtitle),
    company:           best(existing.company,            incoming.company)            ?? '',
    website:           best(existing.website,            incoming.website),
    personallinkedin:  best(existing.personallinkedin,   incoming.personallinkedin),
    companylinkedin:   best(existing.companylinkedin,    incoming.companylinkedin),
    altphonenumber:    best(existing.altphonenumber,     incoming.altphonenumber)    ?? '',
    companyphonenumber:best(existing.companyphonenumber, incoming.companyphonenumber) ?? '',
    emailcode:         best(existing.emailcode,          incoming.emailcode),
    dispositioncode:   best(existing.dispositioncode,    incoming.dispositioncode),
    providercode:      best(existing.providercode,       incoming.providercode),
    status:            (best(existing.status, incoming.status) ?? 'New') as ProspectRow['status'],
    address:           best(existing.address,            incoming.address),
    street:            best(existing.street,             incoming.street),
    city:              best(existing.city,               incoming.city),
    state:             best(existing.state,              incoming.state),
    postalcode:        best(existing.postalcode,         incoming.postalcode),
    country:           best(existing.country,            incoming.country),
    annualrevenue:     best(existing.annualrevenue,      incoming.annualrevenue)     ?? 0,
    industry:          best(existing.industry,           incoming.industry),
    employeesize:      best(existing.employeesize,       incoming.employeesize)      ?? 0,
    siccode:           best(existing.siccode,            incoming.siccode)           ?? 0,
    naicscode:         best(existing.naicscode,          incoming.naicscode)         ?? 0,
    comments:          best(existing.comments,           incoming.comments),
    department:        best(existing.department,         incoming.department),
    seniority:         best(existing.seniority,          incoming.seniority),
    updated_on:        new Date().toISOString(),
    updated_by:        incoming.updated_by,
  }
}

export function ImportModal({ open, onClose, onImported, userId }: ImportModalProps) {
  const [step, setStep]           = useState<Step>('upload')
  const [file, setFile]           = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping]     = useState<Record<string, string>>({})
  const [dupMode, setDupMode]     = useState<DupMode>('merge')
  const [progress, setProgress]   = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [doneChunks, setDoneChunks]   = useState(0)
  const [results, setResults]     = useState({
    inserted: 0, merged: 0, skipped: 0, failed: 0, errors: [] as string[],
  })
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload'); setFile(null); setCsvHeaders([]); setMapping({}); setDupMode('merge')
    setProgress(0); setTotalChunks(0); setDoneChunks(0)
    setResults({ inserted: 0, merged: 0, skipped: 0, failed: 0, errors: [] })
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
    const { allowed } = await rateLimiter.check(userId || 'anon', 'csv_import')
    if (!allowed) return
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

    // ── Create audit session (non-blocking — don't abort if it fails) ──
    const sessionIdStr = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    try {
      await importService.createSession({
        session_id:      sessionIdStr,
        total_chunks:    chunks.length,
        total_prospects: allRows.length,
        created_by:      userId,
      })
    } catch {
      // session tracking unavailable — import still proceeds
    }

    let inserted = 0, merged = 0, skipped = 0, failed = 0
    const errors: string[] = []

    for (let ci = 0; ci < chunks.length; ci++) {
      // ── Map CSV columns → ProspectInsert ──────────────────
      const validRows: ProspectInsert[] = []
      let chunkFailed = 0

      for (const row of chunks[ci]) {
        const mapped: Record<string, string> = {}
        Object.entries(mapping).forEach(([csvCol, dbCol]) => {
          if (dbCol) mapped[dbCol] = row[csvCol] ?? ''
        })
        const email = mapped['email']?.trim()
        if (!email) { chunkFailed++; continue }

        validRows.push({
          fullname:           mapped['fullname'] || `${mapped['firstname'] ?? ''} ${mapped['lastname'] ?? ''}`.trim(),
          firstname:          mapped['firstname'] ?? '',
          lastname:           mapped['lastname'] ?? '',
          jobtitle:           mapped['jobtitle'] || null,
          company:            mapped['company'] ?? '',
          email:              email.toLowerCase(),
          emailcode:          mapped['emailcode'] || null,
          dispositioncode:    mapped['dispositioncode'] || null,
          providercode:       mapped['providercode'] || null,
          status:             (mapped['status'] as ProspectRow['status']) ?? 'New',
          website:            mapped['website'] || null,
          personallinkedin:   mapped['personallinkedin'] || null,
          companylinkedin:    mapped['companylinkedin'] || null,
          altphonenumber:     mapped['altphonenumber'] || '',
          companyphonenumber: mapped['companyphonenumber'] || '',
          address:            mapped['address'] || null,
          street:             mapped['street'] || null,
          city:               mapped['city'] || null,
          state:              mapped['state'] || null,
          postalcode:         mapped['postalcode'] || null,
          country:            mapped['country'] || null,
          annualrevenue:      Number(mapped['annualrevenue']) || 0,
          industry:           mapped['industry'] || null,
          employeesize:       Number(mapped['employeesize']) || 0,
          siccode:            Number(mapped['siccode']) || 0,
          naicscode:          Number(mapped['naicscode']) || 0,
          comments:           mapped['comments'] || null,
          isactive:           true,
          department:         mapped['department'] || null,
          seniority:          mapped['seniority'] || null,
          created_by:         userId,
          updated_by:         null,
        })
      }

      failed += chunkFailed

      if (validRows.length === 0) {
        setDoneChunks(ci + 1)
        setProgress(Math.round(((ci + 1) / chunks.length) * 100))
        continue
      }

      try {
        // ── Dedup check (client-side) ──────────────────────
        const emails = validRows.map(r => r.email!).filter(Boolean)
        const existingMap = await prospectsService.findByEmails(emails)

        const toInsert:    ProspectInsert[] = []
        const toMerge:     Array<{ id: number } & Partial<ProspectRow>> = []
        const toOverwrite: Array<ProspectInsert & { id: number }>  = []

        for (const row of validRows) {
          const existing = row.email ? existingMap.get(row.email.toLowerCase()) : undefined
          if (!existing) {
            toInsert.push(row)
          } else if (dupMode === 'skip') {
            skipped++
          } else if (dupMode === 'merge') {
            toMerge.push(buildMerge(existing, row))
          } else {
            toOverwrite.push({ ...row, id: existing.id })
          }
        }

        // ── Commit via Edge Function (falls back to direct) ──
        const result = await importService.processChunk({
          toInsert,
          toMerge,
          toOverwrite,
          sessionId:          sessionIdStr,
          chunkIndex:         ci,
          totalChunks:        chunks.length,
          cumulativeInserted: inserted,
          cumulativeMerged:   merged,
          cumulativeFailed:   failed,
        })

        inserted += result.inserted
        merged   += result.merged
        failed   += result.failed
        if (result.errors.length > 0) errors.push(...result.errors)

      } catch (err) {
        failed += validRows.length
        errors.push(`Chunk ${ci + 1}: ${err instanceof Error ? err.message : 'Insert failed'}`)
      }

      setDoneChunks(ci + 1)
      setProgress(Math.round(((ci + 1) / chunks.length) * 100))
      await new Promise(r => setTimeout(r, 10))
    }

    setResults({ inserted, merged, skipped, failed, errors: errors.slice(0, 20) })
    onImported()
    const parts = [
      inserted > 0 && `${inserted} added`,
      merged   > 0 && `${merged} ${dupMode === 'overwrite' ? 'overwritten' : 'merged'}`,
      skipped  > 0 && `${skipped} skipped`,
    ].filter(Boolean).join(' · ')
    toast.success(`Import complete — ${parts || 'no records processed'}`)
    setStep('done')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-brand-500" />
            <p className="font-semibold text-foreground">Import CSV</p>
            {file && <span className="text-xs text-muted-foreground">— {file.name}</span>}
          </div>
          <button type="button" onClick={handleClose} aria-label="Close"
            className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Step 1: Upload ─────────────────────────────── */}
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

          {/* ── Step 2: Column mapping + duplicate mode ─────── */}
          {step === 'mapping' && (
            <>
              {/* Column mapping */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Map your CSV columns to database fields. Unmapped columns will be skipped.
                </p>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {csvHeaders.map(h => (
                    <div key={h} className="flex items-center gap-3">
                      <div className="w-36 shrink-0 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground font-medium truncate" title={h}>
                        {h}
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                      <select
                        aria-label={`Map column "${h}"`}
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

              {/* Duplicate handling */}
              <div className="space-y-2.5 pt-1 border-t border-border">
                <p className="text-xs font-semibold text-foreground">Duplicate Handling</p>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Two records are duplicates if they share the same <span className="font-medium text-foreground">email address</span>.
                </p>
                <div className="space-y-2">
                  {DUP_MODES.map(m => (
                    <label key={m.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                        dupMode === m.value
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                      )}>
                      <input type="radio" name="dupMode" value={m.value}
                        checked={dupMode === m.value}
                        onChange={() => setDupMode(m.value)}
                        className="sr-only" />
                      <div className={cn(
                        'h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors',
                        dupMode === m.value ? 'border-brand-500' : 'border-input'
                      )}>
                        {dupMode === m.value && <div className="h-2 w-2 rounded-full bg-brand-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'transition-colors',
                            dupMode === m.value ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'
                          )}>
                            {m.icon}
                          </span>
                          <span className="text-xs font-semibold text-foreground">{m.label}</span>
                          {m.value === 'merge' && (
                            <span className="text-[9px] font-bold uppercase tracking-wide text-brand-500 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: Importing ───────────────────────────── */}
          {step === 'importing' && (
            <div className="space-y-5 py-4 text-center">
              <div className="h-14 w-14 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Importing records…</p>
                <p className="text-sm text-muted-foreground">
                  Processing chunk {doneChunks} of {totalChunks}
                </p>
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

          {/* ── Step 4: Done ────────────────────────────────── */}
          {step === 'done' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">Import Complete</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {results.inserted} added · {results.merged} {dupMode === 'overwrite' ? 'overwritten' : 'merged'} · {results.skipped} skipped · {results.failed} failed
                  </p>
                </div>
              </div>

              {/* Summary breakdown */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Added',    value: results.inserted, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: dupMode === 'overwrite' ? 'Overwritten' : 'Merged', value: results.merged, color: 'text-brand-600 dark:text-brand-400' },
                  { label: 'Skipped',  value: results.skipped,  color: 'text-amber-600 dark:text-amber-400' },
                  { label: 'Failed',   value: results.failed,   color: 'text-rose-600 dark:text-rose-400' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                    Errors ({results.errors.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-3 space-y-1">
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
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          {step === 'upload' && (
            <button type="button" onClick={handleClose}
              className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
          )}
          {step === 'mapping' && (
            <>
              <button type="button" onClick={() => setStep('upload')}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                Back
              </button>
              <button type="button" onClick={startImport}
                className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                Start Import
              </button>
            </>
          )}
          {step === 'done' && (
            <button type="button" onClick={handleClose}
              className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              Done
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv" aria-label="Upload CSV file"
        className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}
