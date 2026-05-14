// ── DB row types — match Supabase schema exactly ────────────────
// These are used in the service layer. Page components map these
// to display shapes as needed.

export interface ProspectRow {
  id: number
  fullname: string | null
  firstname: string | null
  lastname: string | null
  jobtitle: string | null
  company: string | null
  website: string | null
  personallinkedin: string | null
  companylinkedin: string | null
  altphonenumber: string
  companyphonenumber: string
  email: string | null
  emailcode: string | null
  address: string | null
  street: string | null
  city: string | null
  state: string | null
  postalcode: string | null
  country: string | null
  annualrevenue: number
  industry: string | null
  employeesize: number
  siccode: number
  naicscode: number
  dispositioncode: string | null
  providercode: string | null
  comments: string | null
  isactive: boolean
  status: 'New' | 'Contacted' | 'Qualified' | 'Closed'
  department: string | null
  seniority: string | null
  created_by: string | null
  created_on: string
  updated_by: string | null
  updated_on: string | null
}

export type ProspectInsert = Omit<ProspectRow, 'id' | 'created_on' | 'updated_on'>
export type ProspectUpdate = Partial<Omit<ProspectRow, 'id' | 'created_on'>>

export interface CRMUserRow {
  id: string
  auth_id: string | null
  email: string
  role: 'Super Admin' | 'Data Analyst' | 'Agent'
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  profile_url: string | null
  avatar_url: string | null
  birthday: string | null
  phone_no: string | null
  address: string | null
  department: string | null
  permissions: Record<string, unknown>
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface ImportSessionRow {
  id: number
  session_id: string
  total_chunks: number
  processed_chunks: number
  total_prospects: number
  successful_imports: number
  failed_imports: number
  chunk_errors: string[] | null
  status: 'processing' | 'completed' | 'failed'
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface IPEntryRow {
  id: number
  ip_address: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SystemSettingRow {
  id: number
  setting_key: string
  setting_value: string | null
  description: string | null
  updated_at: string
  updated_by: string | null
}

export interface NotificationRow {
  id: string
  user_id: string
  title: string
  body: string | null
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  link: string | null
  created_at: string
}

// Lookup table rows
export interface DispositionRow  { disposition_code: string; disposition_name: string }
export interface EmailStatusRow  { email_code: string;        email_name: string        }
export interface ProviderRow     { provider_code: string;     provider_name: string     }
export interface CountryRow      { country_code: string;      country_name: string      }
export interface IndustryRow     { industry_code: string;     industry_name: string     }
