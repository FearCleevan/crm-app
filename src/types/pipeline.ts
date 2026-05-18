// ── Pipeline types ────────────────────────────────────────────────────────────
// Used across the Data Pipeline feature: upload modal, service layer, and
// the Pipeline Sessions dashboard.

// ── DB row shape for pipeline_sessions table ──────────────────────────────────
export interface PipelineSession {
  id: number
  user_id: string
  created_at: string
  file_name: string
  file_rows: number
  mapped_rows: number
  skipped_rows: number
  imported_rows: number
  status: 'pending' | 'mapping' | 'importing' | 'done' | 'failed'
  error_message: string | null
  column_map: Record<string, string> | null
  notes: string | null
}

export type PipelineSessionInsert = Omit<PipelineSession, 'id' | 'created_at'>
export type PipelineSessionUpdate = Partial<Omit<PipelineSession, 'id' | 'user_id' | 'created_at'>>

// ── Column mapping ─────────────────────────────────────────────────────────────
// Keys = source header from uploaded file
// Values = CRM field key, or null to skip the column
export type ColumnMap = Record<string, string | null>

// ── Row shapes ─────────────────────────────────────────────────────────────────
// One row as parsed from the uploaded file (original header keys)
export type RawRow = Record<string, string>

// One row after cleaning and mapping (CRM field keys)
export type CleanRow = Record<string, string | number | null>

// ── Validation result for a single row ────────────────────────────────────────
export interface RowValidation {
  valid: boolean
  errors: string[]
}

// ── Summary returned after applying mapping + cleaning to all rows ─────────────
export interface PipelineSummary {
  total: number
  valid: number
  skipped: number
  unmappedColumns: string[]
  sampleRows: CleanRow[]   // first 10 rows for the preview step
}

// ── CRM target field registry ─────────────────────────────────────────────────
// Single source of truth for every field the pipeline can populate.
// Required fields must be present (non-empty) for a row to be imported.
export const CRM_FIELDS = [
  { key: 'firstname',          label: 'First Name',        required: true  },
  { key: 'lastname',           label: 'Last Name',         required: true  },
  { key: 'fullname',           label: 'Full Name',         required: false },
  { key: 'jobtitle',           label: 'Job Title',         required: false },
  { key: 'company',            label: 'Company',           required: true  },
  { key: 'email',              label: 'Email',             required: true  },
  { key: 'website',            label: 'Website',           required: false },
  { key: 'personallinkedin',   label: 'Personal LinkedIn', required: false },
  { key: 'companylinkedin',    label: 'Company LinkedIn',  required: false },
  { key: 'altphonenumber',     label: 'Alt Phone',         required: false },
  { key: 'companyphonenumber', label: 'Company Phone',     required: false },
  { key: 'address',            label: 'Address',           required: false },
  { key: 'street',             label: 'Street',            required: false },
  { key: 'city',               label: 'City',              required: false },
  { key: 'state',              label: 'State',             required: false },
  { key: 'postalcode',         label: 'Postal Code',       required: false },
  { key: 'country',            label: 'Country',           required: false },
  { key: 'annualrevenue',      label: 'Annual Revenue',    required: false },
  { key: 'industry',           label: 'Industry',          required: false },
  { key: 'employeesize',       label: 'Employee Size',     required: false },
  { key: 'department',         label: 'Department',        required: false },
  { key: 'seniority',          label: 'Seniority',         required: false },
  { key: 'status',             label: 'Status',            required: false },
  { key: 'comments',           label: 'Comments',          required: false },
] as const

export type CrmFieldKey = typeof CRM_FIELDS[number]['key']

export const CRM_FIELD_KEYS = CRM_FIELDS.map(f => f.key) as CrmFieldKey[]

export const REQUIRED_CRM_FIELDS = CRM_FIELDS
  .filter(f => f.required)
  .map(f => f.key) as CrmFieldKey[]
