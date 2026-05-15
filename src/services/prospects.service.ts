import { supabase } from '@/lib/supabase'
import type { ProspectRow, ProspectInsert, ProspectUpdate } from '@/types/database'

export interface ProspectFilters {
  status?: string[]
  dispositioncode?: string[]
  providercode?: string[]
  country?: string[]
  industry?: string[]
  emailcode?: string[]
  seniority?: string[]
  department?: string[]
  city?: string[]
  isactive?: boolean
  employeesizeMin?: number
  employeesizeMax?: number
  annualrevenueMin?: number
  annualrevenueMax?: number
  dateFrom?: string
  dateTo?: string
}

export interface FilterOptions {
  dispositions:  Array<{ disposition_code: string; disposition_name: string }>
  emailStatuses: Array<{ email_code: string; email_name: string }>
  providers:     Array<{ provider_code: string; provider_name: string }>
  countries:   string[]
  industries:  string[]
  seniorities: string[]
  departments: string[]
  cities:      string[]
}

export interface ProspectSort {
  column: string
  ascending: boolean
}

export interface GetProspectsParams {
  page: number
  limit: number
  search?: string
  filters?: ProspectFilters
  sort?: ProspectSort
}

function applyFilters(
  query: ReturnType<typeof supabase.from>,
  search?: string,
  filters?: ProspectFilters,
) {
  if (search?.trim()) {
    const s = search.trim().replace(/'/g, "''") // escape single quotes
    const SEARCH_FIELDS = [
      'fullname','firstname','lastname','email','company',
      'jobtitle','city','state','country',
      'altphonenumber','companyphonenumber',
    ]
    query = (query as any).or(SEARCH_FIELDS.map(f => `${f}.ilike.%${s}%`).join(','))
  }
  if (filters?.status?.length)          query = (query as any).in('status', filters.status)
  if (filters?.dispositioncode?.length) query = (query as any).in('dispositioncode', filters.dispositioncode)
  if (filters?.providercode?.length)    query = (query as any).in('providercode', filters.providercode)
  if (filters?.country?.length)         query = (query as any).in('country', filters.country)
  if (filters?.industry?.length)        query = (query as any).in('industry', filters.industry)
  if (filters?.emailcode?.length)       query = (query as any).in('emailcode', filters.emailcode)
  if (filters?.seniority?.length)       query = (query as any).in('seniority', filters.seniority)
  if (filters?.department?.length)      query = (query as any).in('department', filters.department)
  if (filters?.city?.length)            query = (query as any).in('city', filters.city)
  if (filters?.isactive !== undefined)  query = (query as any).eq('isactive', filters.isactive)
  if (filters?.employeesizeMin != null) query = (query as any).gte('employeesize', filters.employeesizeMin)
  if (filters?.employeesizeMax != null) query = (query as any).lte('employeesize', filters.employeesizeMax)
  if (filters?.annualrevenueMin != null) query = (query as any).gte('annualrevenue', filters.annualrevenueMin)
  if (filters?.annualrevenueMax != null) query = (query as any).lte('annualrevenue', filters.annualrevenueMax)
  // dateTo: append end-of-day so the entire selected day is included
  if (filters?.dateFrom) query = (query as any).gte('created_on', `${filters.dateFrom}T00:00:00Z`)
  if (filters?.dateTo)   query = (query as any).lte('created_on', `${filters.dateTo}T23:59:59Z`)
  return query
}

export const prospectsService = {
  async getProspects({ page, limit, search, filters, sort }: GetProspectsParams) {
    let query = supabase.from('prospects').select('*', { count: 'exact' })

    query = applyFilters(query as any, search, filters) as any

    if (sort) {
      query = (query as any).order(sort.column, { ascending: sort.ascending })
    } else {
      query = (query as any).order('created_on', { ascending: false })
    }

    const from = (page - 1) * limit
    query = (query as any).range(from, from + limit - 1)

    const { data, error, count } = await (query as any)
    if (error) throw new Error(error.message)
    return { data: (data ?? []) as ProspectRow[], count: count ?? 0 }
  },

  async getProspect(id: number) {
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data as ProspectRow
  },

  async createProspect(payload: ProspectInsert) {
    const { data, error } = await supabase
      .from('prospects')
      .insert(payload)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ProspectRow
  },

  async updateProspect(id: number, updates: ProspectUpdate) {
    const { data, error } = await supabase
      .from('prospects')
      .update({ ...updates, updated_on: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ProspectRow
  },

  async deleteProspect(id: number) {
    const { error } = await supabase.from('prospects').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async bulkDeleteProspects(ids: number[]) {
    const { error } = await supabase.from('prospects').delete().in('id', ids)
    if (error) throw new Error(error.message)
  },

  async bulkUpdateStatus(ids: number[], status: ProspectRow['status']) {
    const { error } = await supabase
      .from('prospects')
      .update({ status, updated_on: new Date().toISOString() })
      .in('id', ids)
    if (error) throw new Error(error.message)
  },

  async bulkCreateProspects(rows: ProspectInsert[]) {
    const { error } = await supabase.from('prospects').insert(rows)
    if (error) throw new Error(error.message)
  },

  async findByEmails(emails: string[]): Promise<Map<string, ProspectRow>> {
    if (!emails.length) return new Map()
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .in('email', emails)
    if (error) throw new Error(error.message)
    const map = new Map<string, ProspectRow>()
    for (const row of (data ?? []) as ProspectRow[]) {
      if (row.email) map.set(row.email.toLowerCase(), row)
    }
    return map
  },

  async bulkOverwriteProspects(rows: Array<ProspectInsert & { id: number }>) {
    // Upsert by PK — replaces all fields
    const { error } = await supabase
      .from('prospects')
      .upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  },

  async bulkMergeProspects(merges: Array<{ id: number } & Partial<ProspectRow>>) {
    // Upsert by PK with pre-computed merged values
    const { error } = await supabase
      .from('prospects')
      .upsert(merges, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  },

  async exportProspects(filters?: ProspectFilters, search?: string) {
    let query = supabase.from('prospects').select('*')
    query = applyFilters(query as any, search, filters) as any
    query = (query as any).order('created_on', { ascending: false })
    const { data, error } = await (query as any)
    if (error) throw new Error(error.message)
    return (data ?? []) as ProspectRow[]
  },

  async getLookups() {
    const [disp, email, prov, country, industry] = await Promise.all([
      supabase.from('prospects_disposition').select('*').order('disposition_name'),
      supabase.from('prospects_email_status').select('*').order('email_name'),
      supabase.from('prospects_provider').select('*').order('provider_name'),
      supabase.from('prospects_country').select('*').order('country_name'),
      supabase.from('prospects_industry').select('*').order('industry_name'),
    ])
    if (disp.error)    throw new Error(disp.error.message)
    if (email.error)   throw new Error(email.error.message)
    if (prov.error)    throw new Error(prov.error.message)
    if (country.error) throw new Error(country.error.message)
    if (industry.error) throw new Error(industry.error.message)
    return {
      dispositions: disp.data ?? [],
      emailStatuses: email.data ?? [],
      providers: prov.data ?? [],
      countries: country.data ?? [],
      industries: industry.data ?? [],
    }
  },

  async getFilterOptions(): Promise<FilterOptions> {
    const [rpcResult, disp, email, prov] = await Promise.all([
      supabase.rpc('get_prospect_filter_options'),
      supabase.from('prospects_disposition').select('*').order('disposition_name'),
      supabase.from('prospects_email_status').select('*').order('email_name'),
      supabase.from('prospects_provider').select('*').order('provider_name'),
    ])
    if (rpcResult.error) throw new Error(rpcResult.error.message)
    const dynamic = (rpcResult.data ?? {}) as {
      countries?: string[]; industries?: string[]; seniorities?: string[]
      departments?: string[]; cities?: string[]
    }
    return {
      dispositions:  (disp.data  ?? []) as FilterOptions['dispositions'],
      emailStatuses: (email.data ?? []) as FilterOptions['emailStatuses'],
      providers:     (prov.data  ?? []) as FilterOptions['providers'],
      countries:   dynamic.countries   ?? [],
      industries:  dynamic.industries  ?? [],
      seniorities: dynamic.seniorities ?? [],
      departments: dynamic.departments ?? [],
      cities:      dynamic.cities      ?? [],
    }
  },
}
