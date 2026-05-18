// ── Pipeline Service ──────────────────────────────────────────────────────────
// Handles: CSV parsing, column mapping application, data cleaning,
// row validation, and conversion to ProspectInsert.
// Everything runs client-side — no network call, no data stored.

import Papa from 'papaparse'
import type { ColumnMap, RawRow, CleanRow, PipelineSummary, RowValidation } from '@/types/pipeline'
import type { ProspectInsert } from '@/types/database'

// ── US states + Canadian provinces → 2-letter abbreviation ───────────────────
const STATE_ABBR: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
  'ontario': 'ON', 'quebec': 'QC', 'british columbia': 'BC', 'alberta': 'AB',
  'manitoba': 'MB', 'saskatchewan': 'SK', 'nova scotia': 'NS',
  'new brunswick': 'NB', 'newfoundland and labrador': 'NL', 'prince edward island': 'PE',
}

const VALID_STATUSES: ProspectInsert['status'][] = ['New', 'Contacted', 'Qualified', 'Closed']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Helpers ───────────────────────────────────────────────────────────────────

// "$1.5M" → 1500000  |  "500K" → 500000  |  "1,200,000" → 1200000
function parseRevenue(raw: string): number {
  const s = raw.replace(/[$,\s]/g, '').toUpperCase()
  if (s.endsWith('B')) return Math.round(parseFloat(s) * 1_000_000_000)
  if (s.endsWith('M')) return Math.round(parseFloat(s) * 1_000_000)
  if (s.endsWith('K')) return Math.round(parseFloat(s) * 1_000)
  const n = parseInt(s, 10)
  return isNaN(n) ? 0 : n
}

// "200-500" → 200  |  "1,000+" → 1000  |  "10K" → 10000
function parseEmployeeSize(raw: string): number {
  const s = raw.replace(/,/g, '').replace(/\+$/, '').toUpperCase()
  const lower = s.split(/[-–—]/)[0].trim()
  if (lower.endsWith('K')) return Math.round(parseFloat(lower) * 1000)
  const n = parseInt(lower, 10)
  return isNaN(n) ? 0 : n
}

// "California" → "CA"  |  "CA" → "CA"  |  unknown → return as-is
function normalizeState(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 2) return trimmed.toUpperCase()
  return STATE_ABBR[trimmed.toLowerCase()] ?? trimmed
}

// "united states" → "United States"
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Smart name splitter
// Strips leading honorifics (Dr., Mr., Mrs., …) and trailing suffixes (Jr., PhD, …)
// then splits on whitespace.
// "Dr. John Smith Jr."  → { firstname: "John", lastname: "Smith" }
// "Michelle O'Brien"    → { firstname: "Michelle", lastname: "O'Brien" }
// "Carlos Lopez"        → { firstname: "Carlos",   lastname: "Lopez"   }
// "Cher"                → { firstname: "Cher",      lastname: ""        }
const HONORIFIC_RE = /^(dr|mr|mrs|ms|miss|prof|rev|hon|capt|lt|col|sgt|cpl)\.?\s+/i
const SUFFIX_RE    = /[,\s]+(jr\.?|sr\.?|ii|iii|iv|v|phd\.?|md\.?|esq\.?|dds\.?)$/i

function splitFullName(full: string): { firstname: string; lastname: string } {
  let name = full.trim()
  name = name.replace(HONORIFIC_RE, '').trim()
  name = name.replace(SUFFIX_RE, '').trim()
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstname: '', lastname: '' }
  if (parts.length === 1) return { firstname: parts[0], lastname: '' }
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') }
}

// "linkedin.com/in/john" | "/in/john" | "john" → "https://www.linkedin.com/in/john"
function normalizeLinkedIn(raw: string, type: 'in' | 'company'): string {
  const s = raw.trim()
  if (!s) return ''
  const slug = s
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^linkedin\.com\//i, '')
    .replace(/^in\//i, '')
    .replace(/^company\//i, '')
    .split('?')[0]
    .replace(/\/+$/, '')
  if (!slug) return ''
  return `https://www.linkedin.com/${type}/${slug}`
}

// Keep only digits, +, (, ), -, space
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+() \-]/g, '').trim()
}

// Strip protocol + www, lowercase
function normalizeWebsite(raw: string): string {
  return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase().trim()
}

// ── Public service ────────────────────────────────────────────────────────────

export const pipelineService = {

  // ── 1. Parse ──────────────────────────────────────────────────────────────────
  // Reads the CSV file with PapaParse and returns raw rows keyed by header.
  parseFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
    return new Promise((resolve, reject) => {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: result => {
          resolve({
            headers: result.meta.fields ?? [],
            rows:    result.data,
          })
        },
        error: err => reject(new Error(err.message)),
      })
    })
  },

  // ── 2. Apply mapping ──────────────────────────────────────────────────────────
  // Renames source keys to CRM keys; drops columns mapped to null.
  applyMapping(rows: RawRow[], columnMap: ColumnMap): CleanRow[] {
    return rows.map(row => {
      const out: CleanRow = {}
      for (const [srcKey, crmKey] of Object.entries(columnMap)) {
        if (!crmKey) continue
        const incoming = String(row[srcKey] ?? '').trim()
        if (!incoming) continue
        const existing = out[crmKey]
        // If two source columns map to the same CRM field, concatenate with space
        out[crmKey] = existing ? `${existing} ${incoming}` : incoming
      }
      return out
    })
  },

  // ── 3. Clean a single row ─────────────────────────────────────────────────────
  // Applies field-level normalisation rules in-place.
  cleanRow(row: CleanRow): CleanRow {
    const c: CleanRow = { ...row }
    const str = (k: string): string => String(c[k] ?? '').trim()

    // Name derivation
    const fn = str('firstname'), ln = str('lastname'), full = str('fullname')
    if (!full && (fn || ln)) c.fullname = `${fn} ${ln}`.trim()
    if (full && (!fn || !ln)) {
      const derived = splitFullName(full)
      if (!fn) c.firstname = derived.firstname
      if (!ln) c.lastname  = derived.lastname
    }

    // Email — lowercase + validate; blank if invalid
    const email = str('email').toLowerCase()
    c.email = EMAIL_RE.test(email) ? email : ''

    // Website
    if (str('website'))           c.website           = normalizeWebsite(str('website'))
    // LinkedIn
    if (str('personallinkedin'))  c.personallinkedin  = normalizeLinkedIn(str('personallinkedin'),  'in')
    if (str('companylinkedin'))   c.companylinkedin   = normalizeLinkedIn(str('companylinkedin'),   'company')
    // Phones
    if (str('altphonenumber'))    c.altphonenumber    = normalizePhone(str('altphonenumber'))
    if (str('companyphonenumber'))c.companyphonenumber= normalizePhone(str('companyphonenumber'))
    // Numeric fields
    c.annualrevenue = str('annualrevenue') ? parseRevenue(str('annualrevenue'))         : 0
    c.employeesize  = str('employeesize')  ? parseEmployeeSize(str('employeesize'))     : 0
    // Location
    if (str('state'))   c.state   = normalizeState(str('state'))
    if (str('country')) c.country = toTitleCase(str('country'))
    // Status
    const st = str('status')
    c.status = VALID_STATUSES.includes(st as ProspectInsert['status']) ? st : 'New'

    return c
  },

  // ── 4. Validate ───────────────────────────────────────────────────────────────
  validateRow(row: CleanRow, opts: { allowNoEmail?: boolean } = {}): RowValidation {
    const errors: string[] = []
    const str = (k: string) => String(row[k] ?? '').trim()

    if (!str('firstname') && !str('fullname'))
      errors.push('Missing name — need firstname or fullname')
    if (!str('company'))
      errors.push('Missing company')

    const email = str('email')
    if (!opts.allowNoEmail) {
      if (!email)
        errors.push('Missing email')
      else if (!EMAIL_RE.test(email))
        errors.push(`Invalid email: "${email}"`)
    } else if (email && !EMAIL_RE.test(email)) {
      // email present but malformed — still reject it
      errors.push(`Invalid email format: "${email}"`)
    }

    return { valid: errors.length === 0, errors }
  },

  // ── 5. Summarise ──────────────────────────────────────────────────────────────
  summarize(
    validRows:       CleanRow[],
    skippedRows:     Array<{ row: CleanRow; errors: string[] }>,
    unmappedColumns: string[],
  ): PipelineSummary {
    return {
      total:           validRows.length + skippedRows.length,
      valid:           validRows.length,
      skipped:         skippedRows.length,
      unmappedColumns,
      sampleRows:      validRows.slice(0, 10),
    }
  },

  // ── 6. Convert to ProspectInsert ──────────────────────────────────────────────
  toProspectInsert(row: CleanRow, userId: string): ProspectInsert {
    const str = (k: string) => String(row[k] ?? '').trim()
    const num = (k: string) => {
      const v = row[k]
      if (typeof v === 'number') return v
      const n = parseInt(String(v ?? '0').replace(/,/g, ''), 10)
      return isNaN(n) ? 0 : n
    }
    const status = str('status')

    return {
      fullname:           str('fullname')           || `${str('firstname')} ${str('lastname')}`.trim() || null,
      firstname:          str('firstname')           || null,
      lastname:           str('lastname')            || null,
      jobtitle:           str('jobtitle')            || '',
      company:            str('company')             || '',
      email:              str('email')               || null,
      emailcode:          null,
      dispositioncode:    null,
      providercode:       null,
      status:             (VALID_STATUSES.includes(status as ProspectInsert['status'])
                            ? status
                            : 'New') as ProspectInsert['status'],
      website:            str('website')             || null,
      personallinkedin:   str('personallinkedin')    || null,
      companylinkedin:    str('companylinkedin')     || null,
      altphonenumber:     str('altphonenumber')      || '',
      companyphonenumber: str('companyphonenumber')  || '',
      address:            str('address')             || null,
      street:             str('street')              || null,
      city:               str('city')                || null,
      state:              str('state')               || null,
      postalcode:         str('postalcode')           || null,
      country:            str('country')             || null,
      annualrevenue:      num('annualrevenue'),
      industry:           str('industry')            || null,
      employeesize:       num('employeesize'),
      siccode:            0,
      naicscode:          0,
      comments:           str('comments')            || null,
      department:         str('department')          || null,
      seniority:          str('seniority')           || null,
      isactive:           true,
      created_by:         userId,
      updated_by:         null,
    }
  },

  // ── 7. Full pipeline run ──────────────────────────────────────────────────────
  // Convenience wrapper: parse → map → clean → validate in one call.
  async processFile(
    file:       File,
    columnMap:  ColumnMap,
    userId:     string,
    opts:       { allowNoEmail?: boolean } = {},
  ): Promise<{
    validRows:       CleanRow[]
    skippedRows:     Array<{ row: CleanRow; errors: string[] }>
    insertPayload:   ProspectInsert[]
    summary:         PipelineSummary
    unmappedColumns: string[]
  }> {
    const { rows } = await this.parseFile(file)

    const unmappedColumns = Object.entries(columnMap)
      .filter(([, v]) => v === null)
      .map(([k]) => k)

    const validRows:   CleanRow[]                                  = []
    const skippedRows: Array<{ row: CleanRow; errors: string[] }>  = []

    for (const raw of rows) {
      const mapped  = this.applyMapping([raw], columnMap)[0]
      const cleaned = this.cleanRow(mapped)
      const { valid, errors } = this.validateRow(cleaned, opts)
      if (valid) validRows.push(cleaned)
      else       skippedRows.push({ row: cleaned, errors })
    }

    return {
      validRows,
      skippedRows,
      insertPayload:   validRows.map(r => this.toProspectInsert(r, userId)),
      summary:         this.summarize(validRows, skippedRows, unmappedColumns),
      unmappedColumns,
    }
  },
}
