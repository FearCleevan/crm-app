// ── Client-side Column Mapper ─────────────────────────────────────────────────
// Maps arbitrary source CSV headers to CRM field keys with zero API calls.
//
// Algorithm (in order of priority):
//   1. Exact alias match          → confidence 1.00
//   2. Contains / contained-by    → confidence 0.85
//   3. Jaccard token-overlap ≥ 0.5 → confidence = score
//   4. No match                   → null
//
// Conflict resolution: first source header to claim a CRM field wins;
// all later headers that would resolve to the same field become null.

import type { ColumnMap, CrmFieldKey } from '@/types/pipeline'
import { CRM_FIELD_KEYS } from '@/types/pipeline'

// ── Alias dictionary ──────────────────────────────────────────────────────────
// Every entry is already normalised (lowercase, spaces only, no special chars).
// Add new aliases here as new data sources are encountered.
const FIELD_ALIASES: Record<CrmFieldKey, string[]> = {
  // ── Name fields ──────────────────────────────────────────────
  firstname: [
    'first name', 'first_name', 'firstname', 'given name', 'fname',
    'contact first name', 'first', 'forename', 'christian name',
  ],
  lastname: [
    'last name', 'last_name', 'lastname', 'surname', 'lname', 'family name',
    'contact last name', 'last', 'second name',
  ],
  fullname: [
    'full name', 'fullname', 'full_name', 'name', 'contact name',
    'contact full name', 'person name', 'display name', 'prospect name',
    'lead name', 'customer name',
  ],

  // ── Job / role ────────────────────────────────────────────────
  jobtitle: [
    'job title', 'title', 'job_title', 'position', 'role', 'occupation',
    'designation', 'function', 'current title', 'contact title',
    'job function', 'job position', 'work title',
  ],
  seniority: [
    'seniority', 'seniority level', 'level', 'management level', 'job level',
    'career level', 'experience level', 'rank', 'grade',
  ],
  department: [
    'department', 'dept', 'division', 'business unit', 'team',
    'contact department', 'functional area',
  ],

  // ── Company ───────────────────────────────────────────────────
  company: [
    'company', 'company name', 'company name cleaned', 'organization',
    'organisation', 'employer', 'firm', 'account', 'account name',
    'business', 'business name', 'current company', 'contact company',
    'company name - cleaned', 'company (cleaned)',
  ],
  industry: [
    'industry', 'sector', 'vertical', 'company industry', 'business type',
    'industry sector', 'market', 'niche',
  ],
  employeesize: [
    'employee count', 'employees', 'staff count', 'headcount',
    'company size', 'company staff count', 'number of employees',
    'employee size', 'team size', 'workforce', 'employee number',
    'no of employees', 'num employees', 'total employees',
    'company headcount', 'staff size',
  ],
  annualrevenue: [
    'annual revenue', 'revenue', 'yearly revenue', 'company annual revenue',
    'company revenue', 'arr', 'annual sales', 'turnover', 'company turnover',
    'revenue usd', 'revenue amount',
  ],

  // ── Contact info ──────────────────────────────────────────────
  email: [
    'email', 'email address', 'primary email', 'work email',
    'business email', 'email 1', 'contact email', 'e-mail',
    'e mail', 'mail', 'corporate email',
  ],
  altphonenumber: [
    'phone', 'phone number', 'contact phone', 'mobile', 'cell',
    'direct phone', 'contact phone 1', 'direct dial', 'personal phone',
    'mobile phone', 'cell phone', 'phone 1', 'telephone', 'tel',
    'direct number', 'contact number', 'alt phone',
  ],
  companyphonenumber: [
    'company phone', 'company phone number', 'hq phone', 'company phone 1',
    'office phone', 'switchboard', 'company telephone', 'headquarters phone',
    'corporate phone', 'main phone', 'company tel',
  ],

  // ── Web presence ──────────────────────────────────────────────
  website: [
    'website', 'web', 'url', 'company website', 'company url',
    'web address', 'domain', 'homepage', 'site', 'company site',
    'company domain', 'web site',
  ],
  personallinkedin: [
    'linkedin', 'personal linkedin', 'linkedin url', 'contact linkedin',
    'linkedin profile', 'contact li profile url', 'li profile',
    'linkedin profile url', 'linkedin link', 'personal linkedin url',
    'linkedin page', 'contact linkedin url', 'linkedin profile link',
  ],
  companylinkedin: [
    'company linkedin', 'company li profile url', 'company linkedin url',
    'organization linkedin', 'company linkedin profile',
    'company linkedin link', 'corporate linkedin',
  ],

  // ── Address ───────────────────────────────────────────────────
  address: [
    'address', 'full address', 'contact location', 'location',
    'contact address', 'mailing address', 'postal address',
  ],
  street: [
    'street', 'street address', 'address line 1', 'company street',
    'company street 1', 'street 1', 'address 1', 'addr1', 'street line',
  ],
  city: [
    'city', 'town', 'contact city', 'company city', 'location city',
    'municipality', 'locality', 'city name',
  ],
  state: [
    'state', 'province', 'region', 'contact state', 'company state',
    'state abbr', 'contact state abbr', 'company state abbr',
    'state province', 'state or province', 'state/province', 'county',
    'contact county',
  ],
  postalcode: [
    'postal code', 'zip', 'zip code', 'postcode', 'company post code',
    'postal', 'zip postal', 'post code', 'zipcode', 'pin code',
    'pin', 'company postcode',
  ],
  country: [
    'country', 'contact country', 'company country', 'nation',
    'country code', 'country name', 'location country',
  ],

  // ── CRM meta ──────────────────────────────────────────────────
  status: [
    'status', 'lead status', 'contact status', 'prospect status',
    'record status', 'stage',
  ],
  comments: [
    'comments', 'notes', 'remarks', 'description', 'memo',
    'additional info', 'extra', 'note', 'comment',
  ],
}

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[-_]+/g, ' ')      // dashes / underscores → space
    .replace(/[^a-z0-9 ]/g, ' ') // strip everything else
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim()
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function jaccardScore(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean))
  const tb = new Set(b.split(' ').filter(Boolean))
  let inter = 0
  ta.forEach(t => { if (tb.has(t)) inter++ })
  const union = new Set([...ta, ...tb]).size
  return union === 0 ? 0 : inter / union
}

interface FieldScore {
  field: CrmFieldKey
  confidence: number
}

function bestMatch(normHeader: string): FieldScore | null {
  let best: FieldScore | null = null

  for (const field of CRM_FIELD_KEYS) {
    const aliases = FIELD_ALIASES[field]
    let score = 0

    // 1. Exact alias match
    if (aliases.includes(normHeader)) {
      score = 1.0
    }

    // 2. Alias contains / is contained by the header
    if (score === 0) {
      for (const alias of aliases) {
        if (normHeader.includes(alias) || alias.includes(normHeader)) {
          score = Math.max(score, 0.85)
        }
      }
    }

    // 3. Jaccard token overlap (threshold 0.5)
    if (score === 0) {
      for (const alias of aliases) {
        const j = jaccardScore(normHeader, alias)
        if (j >= 0.5) score = Math.max(score, j)
      }
    }

    // 4. Also score directly against the field key itself
    if (score === 0) {
      const j = jaccardScore(normHeader, field)
      if (j >= 0.6) score = Math.max(score, j * 0.8)
    }

    if (score > 0 && (!best || score > best.confidence)) {
      best = { field, confidence: score }
    }
  }

  return best && best.confidence >= 0.5 ? best : null
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MappingResult {
  /** The final column map: source header → CRM field key or null */
  mapping: ColumnMap
  /** Confidence score (0–1) per source header */
  confidence: Record<string, number>
  /** Source headers that could not be mapped */
  unmapped: string[]
}

/**
 * Maps an array of source headers to CRM field keys.
 * Runs entirely client-side — no API call required.
 *
 * Conflict resolution: the first source header to match a CRM field wins.
 * Subsequent headers that resolve to the same field become null (skipped).
 */
export function mapColumns(sourceHeaders: string[]): MappingResult {
  const mapping: ColumnMap = {}
  const confidence: Record<string, number> = {}
  const claimed = new Set<CrmFieldKey>()
  const unmapped: string[] = []

  for (const header of sourceHeaders) {
    const norm = normalise(header)
    const match = bestMatch(norm)

    if (!match || claimed.has(match.field)) {
      mapping[header] = null
      confidence[header] = 0
      if (!match) unmapped.push(header)
    } else {
      mapping[header] = match.field
      confidence[header] = match.confidence
      claimed.add(match.field)
    }
  }

  return { mapping, confidence, unmapped }
}

/**
 * Re-maps a single header — used when the user edits a dropdown in the UI.
 * Returns the new full mapping with conflicts resolved.
 */
export function remapColumn(
  sourceHeaders: string[],
  currentMapping: ColumnMap,
  changedHeader: string,
  newFieldKey: string | null,
): ColumnMap {
  const next: ColumnMap = { ...currentMapping }

  // If the new target is already claimed by another header, clear that one first
  if (newFieldKey) {
    for (const [h, f] of Object.entries(next)) {
      if (f === newFieldKey && h !== changedHeader) {
        next[h] = null
      }
    }
  }

  next[changedHeader] = newFieldKey
  return next
}
