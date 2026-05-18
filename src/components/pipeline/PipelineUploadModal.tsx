import { useState, useRef, useCallback } from 'react'
import {
  X, FileText, ChevronRight, AlertTriangle, CheckCircle2,
  AlertCircle, RotateCcw, Workflow,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { mapColumns, remapColumn } from '@/services/columnMapper'
import { pipelineService } from '@/services/pipeline.service'
import { pipelineSessionsService } from '@/services/pipelineSessions.service'
import { prospectsService } from '@/services/prospects.service'
import { invalidateFilterCache } from '@/hooks/useFilterOptions'
import { CRM_FIELDS, REQUIRED_CRM_FIELDS } from '@/types/pipeline'
import type { ColumnMap, CleanRow, PipelineSummary } from '@/types/pipeline'
import type { ProspectInsert, ProspectRow } from '@/types/database'

type Step = 1 | 2 | 3 | 4
type ImportState = 'idle' | 'running' | 'done' | 'failed'
type DupMode = 'skip' | 'merge' | 'overwrite'

const BATCH_SIZE = 500

// Merge helper — existing wins unless empty/null/zero
function best<T>(existing: T | null | undefined, incoming: T | null | undefined): T | null {
  const empty = (v: unknown) => v === null || v === undefined || v === '' || v === 0
  return empty(existing) ? (incoming ?? null) : (existing as T)
}

function buildMerge(existing: ProspectRow, incoming: ProspectInsert): Partial<ProspectRow> & { id: number } {
  return {
    id:                 existing.id,
    fullname:           best(existing.fullname,           incoming.fullname)           ?? '',
    firstname:          best(existing.firstname,          incoming.firstname)          ?? '',
    lastname:           best(existing.lastname,           incoming.lastname)           ?? '',
    jobtitle:           best(existing.jobtitle,           incoming.jobtitle),
    company:            best(existing.company,            incoming.company)            ?? '',
    website:            best(existing.website,            incoming.website),
    personallinkedin:   best(existing.personallinkedin,   incoming.personallinkedin),
    companylinkedin:    best(existing.companylinkedin,    incoming.companylinkedin),
    altphonenumber:     best(existing.altphonenumber,     incoming.altphonenumber)     ?? '',
    companyphonenumber: best(existing.companyphonenumber, incoming.companyphonenumber) ?? '',
    emailcode:          best(existing.emailcode,          incoming.emailcode),
    dispositioncode:    best(existing.dispositioncode,    incoming.dispositioncode),
    providercode:       best(existing.providercode,       incoming.providercode),
    status:             (best(existing.status, incoming.status) ?? 'New') as ProspectRow['status'],
    address:            best(existing.address,            incoming.address),
    street:             best(existing.street,             incoming.street),
    city:               best(existing.city,               incoming.city),
    state:              best(existing.state,              incoming.state),
    postalcode:         best(existing.postalcode,         incoming.postalcode),
    country:            best(existing.country,            incoming.country),
    annualrevenue:      best(existing.annualrevenue,      incoming.annualrevenue)      ?? 0,
    industry:           best(existing.industry,           incoming.industry),
    employeesize:       best(existing.employeesize,       incoming.employeesize)       ?? 0,
    comments:           best(existing.comments,           incoming.comments),
    department:         best(existing.department,         incoming.department),
    seniority:          best(existing.seniority,          incoming.seniority),
    updated_on:         new Date().toISOString(),
    updated_by:         incoming.updated_by,
  }
}

const STEP_LABELS = ['Upload', 'Mapping', 'Preview', 'Import'] as const

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ score }: { score: number }) {
  if (score === 0) return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
      Skip
    </span>
  )
  if (score >= 0.99) return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
      Exact
    </span>
  )
  if (score >= 0.84) return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
      Similar
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
      Fuzzy
    </span>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 shrink-0">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as Step
        const done = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
              done   && 'text-emerald-600 dark:text-emerald-400',
              active && 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20',
              !done && !active && 'text-muted-foreground',
            )}>
              <div className={cn(
                'h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                done   && 'bg-emerald-500 text-white',
                active && 'bg-brand-500 text-white',
                !done && !active && 'bg-muted text-muted-foreground',
              )}>
                {done ? '✓' : step}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface PipelineUploadModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
  userId: string
}

export function PipelineUploadModal({ open, onClose, onImported, userId }: PipelineUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Shared state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parsing, setParsing] = useState(false)

  // Step 2
  const [rawHeaders, setRawHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<ColumnMap>({})
  const [confidence, setConfidence] = useState<Record<string, number>>({})

  // Step 3
  const [processing, setProcessing] = useState(false)
  const [validRows, setValidRows] = useState<CleanRow[]>([])
  const [skippedRows, setSkippedRows] = useState<Array<{ row: CleanRow; errors: string[] }>>([])
  const [summary, setSummary] = useState<PipelineSummary | null>(null)
  const [insertPayload, setInsertPayload] = useState<ProspectInsert[]>([])
  const [showAllSkipped, setShowAllSkipped] = useState(false)
  const [dupMode, setDupMode] = useState<DupMode>('skip')
  const [allowNoEmail, setAllowNoEmail] = useState(false)

  // Step 4
  const [importState, setImportState] = useState<ImportState>('idle')
  const [progress, setProgress] = useState(0)
  const [imported, setImported] = useState(0)
  const [dupMerged, setDupMerged] = useState(0)
  const [dupSkipped, setDupSkipped] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)
  const sessionIdRef = useRef<number | null>(null)

  // ── Reset ─────────────────────────────────────────────────────
  function reset() {
    setStep(1); setFile(null); setIsDragging(false); setParsing(false)
    setRawHeaders([]); setColumnMap({}); setConfidence({})
    setProcessing(false); setValidRows([]); setSkippedRows([]); setSummary(null); setInsertPayload([])
    setShowAllSkipped(false); setDupMode('skip'); setAllowNoEmail(false)
    setImportState('idle'); setProgress(0); setImported(0); setDupMerged(0); setDupSkipped(0); setImportError(null)
    sessionIdRef.current = null
  }

  function handleClose() { reset(); onClose() }

  // ── Step 1: File handling ──────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }
    setFile(f)
    setParsing(true)
    try {
      const { headers } = await pipelineService.parseFile(f)
      setRawHeaders(headers)
      const result = mapColumns(headers)
      setColumnMap(result.mapping)
      setConfidence(result.confidence)
      setStep(2)
    } catch {
      toast.error('Failed to parse CSV — please check the file format')
      setFile(null)
    } finally {
      setParsing(false)
    }
  }, [])

  // ── Step 2: Mapping edit ──────────────────────────────────────
  function handleRemapColumn(header: string, newKey: string | null) {
    setColumnMap(prev => remapColumn(rawHeaders, prev, header, newKey))
    if (newKey) {
      setConfidence(prev => ({ ...prev, [header]: 1.0 }))
    } else {
      setConfidence(prev => ({ ...prev, [header]: 0 }))
    }
  }

  async function handlePreview() {
    if (!file) return
    setProcessing(true)
    try {
      const result = await pipelineService.processFile(file, columnMap, userId, { allowNoEmail })
      setValidRows(result.validRows)
      setSkippedRows(result.skippedRows)
      setSummary(result.summary)
      setInsertPayload(result.insertPayload)
      setStep(3)
    } catch {
      toast.error('Failed to process file')
    } finally {
      setProcessing(false)
    }
  }

  async function toggleAllowNoEmail() {
    if (!file) return
    const next = !allowNoEmail
    setAllowNoEmail(next)
    setProcessing(true)
    try {
      const result = await pipelineService.processFile(file, columnMap, userId, { allowNoEmail: next })
      setValidRows(result.validRows)
      setSkippedRows(result.skippedRows)
      setSummary(result.summary)
      setInsertPayload(result.insertPayload)
    } catch {
      toast.error('Failed to re-process file')
    } finally {
      setProcessing(false)
    }
  }

  // ── Step 4: Import ────────────────────────────────────────────
  async function runImport() {
    if (!insertPayload.length || !file || !summary) return
    setImportState('running')
    setProgress(0)
    setImported(0)
    setDupMerged(0)
    setDupSkipped(0)
    setImportError(null)
    setStep(4)

    const columnMapSnapshot = Object.fromEntries(
      Object.entries(columnMap).filter(([, v]) => v !== null)
    ) as Record<string, string>

    try {
      sessionIdRef.current = await pipelineSessionsService.createSession({
        user_id:       userId,
        file_name:     file.name,
        file_rows:     summary.total,
        mapped_rows:   summary.valid,
        skipped_rows:  summary.skipped,
        imported_rows: 0,
        status:        'importing',
        column_map:    columnMapSnapshot,
        error_message: null,
        notes:         null,
      })
    } catch { /* non-fatal */ }

    try {
      const total = insertPayload.length
      let done = 0, merged = 0, skippedDup = 0

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = insertPayload.slice(i, i + BATCH_SIZE)

        // Dedup check
        const emails = batch.map(r => r.email).filter(Boolean) as string[]
        const existingMap = await prospectsService.findByEmails(emails)

        const toInsert:    ProspectInsert[] = []
        const toMerge:     Array<Partial<ProspectRow> & { id: number }> = []
        const toOverwrite: Array<ProspectInsert & { id: number }> = []
        // Track emails seen within this batch to catch intra-batch duplicates
        const batchSeen = new Set<string>()

        for (const row of batch) {
          const emailKey = row.email ? row.email.toLowerCase() : ''
          const existing = emailKey ? existingMap.get(emailKey) : undefined

          // Intra-batch duplicate (same email appeared earlier in this batch)
          if (emailKey && batchSeen.has(emailKey)) {
            skippedDup++
            continue
          }
          if (emailKey) batchSeen.add(emailKey)

          if (!existing) {
            toInsert.push(row)
          } else if (dupMode === 'skip') {
            skippedDup++
          } else if (dupMode === 'merge') {
            toMerge.push(buildMerge(existing, row))
            merged++
          } else {
            toOverwrite.push({ ...row, id: existing.id })
            merged++
          }
        }

        if (toInsert.length)    await prospectsService.bulkCreateProspects(toInsert)
        if (toMerge.length)     await prospectsService.bulkMergeProspects(toMerge)
        if (toOverwrite.length) await prospectsService.bulkOverwriteProspects(toOverwrite)

        done += toInsert.length
        setImported(done)
        setDupMerged(merged)
        setDupSkipped(skippedDup)
        setProgress(Math.round(((i + batch.length) / total) * 100))
      }

      if (sessionIdRef.current !== null) {
        try {
          await pipelineSessionsService.updateSession(sessionIdRef.current, {
            status:        'done',
            imported_rows: done,
          })
        } catch { /* non-fatal */ }
      }

      setImportState('done')
      invalidateFilterCache()
      onImported()
      const parts = [
        done    > 0 && `${done.toLocaleString()} added`,
        merged  > 0 && `${merged.toLocaleString()} ${dupMode === 'overwrite' ? 'overwritten' : 'merged'}`,
        skippedDup > 0 && `${skippedDup.toLocaleString()} duplicates skipped`,
      ].filter(Boolean).join(' · ')
      toast.success(`Pipeline complete — ${parts}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed'

      if (sessionIdRef.current !== null) {
        try {
          await pipelineSessionsService.updateSession(sessionIdRef.current, {
            status:        'failed',
            imported_rows: imported,
            error_message: msg,
          })
        } catch { /* non-fatal */ }
      }

      setImportError(msg)
      setImportState('failed')
      toast.error('Pipeline import failed')
    }
  }

  // ── Computed helpers ──────────────────────────────────────────
  const mappedCount  = Object.values(columnMap).filter(Boolean).length
  const totalHeaders = rawHeaders.length

  const mappedValues = Object.values(columnMap).filter(Boolean) as string[]
  // fullname satisfies the firstname/lastname requirement (cleanRow derives them)
  const nameIsSatisfied = mappedValues.some(v => ['firstname', 'lastname', 'fullname'].includes(v))
  const requiredMissing = REQUIRED_CRM_FIELDS.filter(rf => {
    if (rf === 'firstname' || rf === 'lastname') return !nameIsSatisfied
    return !mappedValues.includes(rf)
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={step < 4 ? handleClose : undefined} />

      <div className="relative z-10 w-full sm:max-w-2xl bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in-0 zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Workflow className="h-4 w-4 text-brand-500 shrink-0" />
            <p className="font-semibold text-foreground shrink-0">Data Pipeline</p>
            {file && <span className="text-xs text-muted-foreground truncate">— {file.name}</span>}
          </div>
          <div className="flex items-center gap-3">
            <StepIndicator current={step} />
            {importState !== 'running' && (
              <button type="button" onClick={handleClose} aria-label="Close"
                className="h-8 w-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors shrink-0">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step 1: File Upload ───────────────────────────── */}
          {step === 1 && (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault(); setIsDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
              onClick={() => !parsing && fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all select-none',
                parsing
                  ? 'border-brand-300 bg-brand-50/50 dark:bg-brand-900/10 cursor-default'
                  : isDragging
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-border hover:border-brand-400 hover:bg-muted/50',
              )}
            >
              {parsing ? (
                <>
                  <div className="h-10 w-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mx-auto mb-4" />
                  <p className="font-semibold text-foreground">Analyzing file…</p>
                  <p className="text-sm text-muted-foreground mt-1">Detecting columns and mapping to CRM fields</p>
                </>
              ) : (
                <>
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-semibold text-foreground">Drop your CSV here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-3">Accepts any column format — we'll map it automatically</p>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Column Mapping ────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Review and adjust how your CSV columns map to CRM fields.
                </p>
                <span className={cn(
                  'text-xs font-semibold px-2 py-1 rounded-full',
                  mappedCount === totalHeaders
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {mappedCount} / {totalHeaders} mapped
                </span>
              </div>

              {/* Required fields warning */}
              {requiredMissing.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                  <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-700 dark:text-rose-400">
                    <span className="font-semibold">Required fields not mapped:</span>{' '}
                    {requiredMissing.map(k => CRM_FIELDS.find(f => f.key === k)?.label ?? k).join(', ')}.
                    Rows without these fields will be skipped.
                  </p>
                </div>
              )}

              {/* Mapping table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-0 text-xs font-semibold text-muted-foreground bg-muted/50 px-4 py-2.5 border-b border-border">
                  <span>Source Column</span>
                  <span />
                  <span>Maps To (CRM Field)</span>
                </div>
                <div className="max-h-[calc(60vh-180px)] overflow-y-auto divide-y divide-border">
                  {rawHeaders.map(header => {
                    const mapped = columnMap[header]
                    const conf   = confidence[header] ?? 0
                    return (
                      <div key={header} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                        {/* Source */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-foreground font-medium truncate" title={header}>{header}</span>
                          <ConfidenceBadge score={conf} />
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                        {/* CRM field select */}
                        <select
                          aria-label={`Map column "${header}"`}
                          value={mapped ?? ''}
                          onChange={e => handleRemapColumn(header, e.target.value || null)}
                          className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">— skip this column —</option>
                          {CRM_FIELDS.map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}{f.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">* Required field — rows missing required fields are skipped</p>
            </div>
          )}

          {/* ── Step 3: Data Preview ──────────────────────────── */}
          {step === 3 && summary && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Rows',   value: summary.total,   color: 'text-foreground' },
                  { label: 'Ready',        value: summary.valid,   color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Skipped',      value: summary.skipped, color: summary.skipped > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Unmapped columns warning */}
              {summary.unmappedColumns.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">{summary.unmappedColumns.length} columns skipped:</span>{' '}
                    {summary.unmappedColumns.slice(0, 5).join(', ')}
                    {summary.unmappedColumns.length > 5 && ` +${summary.unmappedColumns.length - 5} more`}
                  </p>
                </div>
              )}

              {/* Sample rows table */}
              {summary.sampleRows.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">
                    Preview — first {summary.sampleRows.length} valid rows
                  </p>
                  <div className="rounded-xl border border-border overflow-auto max-h-48">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          {['Full Name', 'First Name', 'Last Name', 'Email', 'Company'].map(h => (
                            <th key={h} className="px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {summary.sampleRows.map((row, i) => (
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-1.5 text-foreground truncate max-w-[130px]">
                              {String(row.fullname ?? '')}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[100px]">
                              {String(row.firstname ?? '')}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[100px]">
                              {String(row.lastname ?? '')}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[150px]">
                              {String(row.email ?? '')}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[120px]">
                              {String(row.company ?? '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Email toggle */}
              <div className="rounded-xl border border-border p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Include rows without email</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {allowNoEmail
                      ? 'Rows missing an email will be imported — no dedup check possible for those rows.'
                      : 'Rows missing an email are skipped (default).'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowNoEmail ? 'true' : 'false'}
                  aria-label="Include rows without email"
                  onClick={toggleAllowNoEmail}
                  disabled={processing}
                  className={cn(
                    'relative shrink-0 h-6 w-11 rounded-full border-2 transition-colors duration-200 disabled:opacity-50',
                    allowNoEmail
                      ? 'bg-brand-500 border-brand-500'
                      : 'bg-muted border-border',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                    allowNoEmail && 'translate-x-5',
                  )} />
                </button>
              </div>

              {/* Duplicate handling */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Duplicate Handling</p>
                <p className="text-[11px] text-muted-foreground">
                  Two records are duplicates if they share the same <span className="font-medium text-foreground">email address</span>.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { value: 'skip'      as DupMode, label: 'Skip duplicates',  desc: 'Keep existing record unchanged' },
                    { value: 'merge'     as DupMode, label: 'Merge',            desc: 'Fill blank fields from new data' },
                    { value: 'overwrite' as DupMode, label: 'Overwrite',        desc: 'Replace all fields with new data' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDupMode(opt.value)}
                      className={cn(
                        'flex-1 min-w-[100px] rounded-lg border px-3 py-2 text-left transition-colors',
                        dupMode === opt.value
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30',
                      )}
                    >
                      <p className={cn('text-xs font-semibold', dupMode === opt.value ? 'text-brand-600 dark:text-brand-400' : 'text-foreground')}>
                        {opt.label}
                        {opt.value === 'skip' && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-brand-500 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded-full">Default</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skipped rows */}
              {skippedRows.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    Skipped rows ({skippedRows.length})
                  </p>
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                    <div className="divide-y divide-amber-100 dark:divide-amber-900/30 max-h-36 overflow-y-auto">
                      {(showAllSkipped ? skippedRows : skippedRows.slice(0, 5)).map((s, i) => (
                        <div key={i} className="px-3 py-2 flex items-start gap-2">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 shrink-0">
                            Row {i + 1}
                          </span>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            {s.errors.join(' · ')}
                          </p>
                        </div>
                      ))}
                    </div>
                    {skippedRows.length > 5 && !showAllSkipped && (
                      <button type="button" onClick={() => setShowAllSkipped(true)}
                        className="w-full py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-amber-200 dark:border-amber-800 transition-colors">
                        Show all {skippedRows.length} skipped rows
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Import progress / done / error ────────── */}
          {step === 4 && (
            <div className="py-6 space-y-6">
              {importState === 'running' && (
                <div className="text-center space-y-4">
                  <div className="h-14 w-14 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin mx-auto" />
                  <div>
                    <p className="font-semibold text-foreground">Importing records…</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {imported.toLocaleString()} of {insertPayload.length.toLocaleString()} processed
                    </p>
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{progress}% complete</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {importState === 'done' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">Import Complete</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        {imported.toLocaleString()} added
                        {dupMerged > 0 && ` · ${dupMerged.toLocaleString()} ${dupMode === 'overwrite' ? 'overwritten' : 'merged'}`}
                        {dupSkipped > 0 && ` · ${dupSkipped.toLocaleString()} duplicates skipped`}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Added',      value: imported,             color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: dupMode === 'overwrite' ? 'Overwritten' : 'Merged', value: dupMerged, color: 'text-brand-600 dark:text-brand-400' },
                      { label: 'Dup Skipped',value: dupSkipped,           color: 'text-amber-600 dark:text-amber-400' },
                      { label: 'Invalid',    value: summary?.skipped ?? 0, color: 'text-muted-foreground' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                        <p className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importState === 'failed' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                    <AlertCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-rose-800 dark:text-rose-200">Import Failed</p>
                      <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">{importError}</p>
                    </div>
                  </div>
                  {imported > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {imported.toLocaleString()} records were imported before the error.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          {/* Left: back / cancel */}
          <div>
            {step === 1 && (
              <button type="button" onClick={handleClose}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
            )}
            {step === 2 && (
              <button type="button" onClick={() => { setStep(1); setFile(null) }}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                Back
              </button>
            )}
            {step === 3 && (
              <button type="button" onClick={() => setStep(2)}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
                Back
              </button>
            )}
          </div>

          {/* Right: primary action */}
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button type="button" onClick={handlePreview} disabled={processing || mappedCount === 0}
                className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                {processing && <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />}
                {processing ? 'Processing…' : 'Preview Data'}
              </button>
            )}

            {step === 3 && (
              <button type="button"
                onClick={runImport}
                disabled={validRows.length === 0}
                className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                Import {validRows.length.toLocaleString()} Records
              </button>
            )}

            {step === 4 && importState === 'failed' && (
              <button type="button" onClick={() => { setImportState('idle'); setStep(3) }}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Back to Preview
              </button>
            )}

            {step === 4 && importState === 'done' && (
              <button type="button" onClick={handleClose}
                className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                Done
              </button>
            )}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv" aria-label="Upload CSV file"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}
