import { supabase } from '@/lib/supabase'
import type { ProspectRow, ProspectInsert, ProspectUpdate } from '@/types/database'

export interface ProspectFilters {
  status?: string
  dispositioncode?: string
  providercode?: string
  country?: string
  industry?: string
  isactive?: boolean
  emailcode?: string
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
    const s = search.trim()
    query = (query as any).or(
      `fullname.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%`
    )
  }
  if (filters?.status)          query = (query as any).eq('status', filters.status)
  if (filters?.dispositioncode) query = (query as any).eq('dispositioncode', filters.dispositioncode)
  if (filters?.providercode)    query = (query as any).eq('providercode', filters.providercode)
  if (filters?.country)         query = (query as any).eq('country', filters.country)
  if (filters?.industry)        query = (query as any).eq('industry', filters.industry)
  if (filters?.emailcode)       query = (query as any).eq('emailcode', filters.emailcode)
  if (filters?.isactive !== undefined) query = (query as any).eq('isactive', filters.isactive)
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
}
