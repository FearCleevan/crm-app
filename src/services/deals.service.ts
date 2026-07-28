import { supabase } from '@/lib/supabase'
import type { DealRow, DealInsert, DealUpdate, DealActivityRow, DealActivityInsert, DealStage } from '@/types/database'

export interface DealFilters {
  stage?: string[]
  assignedTo?: string
}

export interface DealSort {
  column: string
  ascending: boolean
}

class DealsService {
  // ── Deals CRUD ────────────────────────────────────────────

  async getDeals(params: {
    page?: number
    limit?: number
    search?: string
    filters?: DealFilters
    sort?: DealSort
  } = {}): Promise<{ data: DealRow[]; count: number }> {
    const { page = 1, limit = 100, search, filters, sort } = params
    const from = (page - 1) * limit
    const to   = from + limit - 1

    let q = supabase.from('deals').select('*', { count: 'exact' })

    if (search?.trim()) {
      const term = search.trim().replace(/[%,]/g, '')
      q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%,prospect_name.ilike.%${term}%`)
    }
    if (filters?.stage?.length)  q = q.in('stage', filters.stage)
    if (filters?.assignedTo)     q = q.eq('assigned_to', filters.assignedTo)

    if (sort) {
      q = q.order(sort.column, { ascending: sort.ascending })
    } else {
      q = q.order('sort_order', { ascending: true })
       .order('created_at',  { ascending: false })
    }

    q = q.range(from, to)

    const { data, count, error } = await q
    if (error) throw error
    return { data: (data ?? []) as DealRow[], count: count ?? 0 }
  }

  async getDeal(id: string): Promise<DealRow> {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as DealRow
  }

  async createDeal(payload: DealInsert): Promise<DealRow> {
    const { data, error } = await supabase
      .from('deals')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as DealRow
  }

  async updateDeal(id: string, updates: DealUpdate): Promise<DealRow> {
    const { data, error } = await supabase
      .from('deals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as DealRow
  }

  async deleteDeal(id: string): Promise<void> {
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) throw error
  }

  async moveStage(id: string, stage: DealStage, createdBy?: string | null): Promise<DealRow> {
    const updated = await this.updateDeal(id, {
      stage,
      stage_changed_at: new Date().toISOString(),
    })
    // Log stage change to activity feed
    await this.addActivity({
      deal_id:     id,
      type:        'status',
      title:       `Stage updated to ${stage}`,
      description: null,
      created_by:  createdBy ?? null,
    })
    return updated
  }

  // Bulk update sort_order for kanban reordering
  async reorderDeals(updates: { id: string; sort_order: number }[]): Promise<void> {
    await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from('deals').update({ sort_order }).eq('id', id)
      )
    )
  }

  // ── Activities ────────────────────────────────────────────

  async getActivities(dealId: string): Promise<DealActivityRow[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('id, deal_id, type, title, description, status, created_by, created_at, updated_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as DealActivityRow[]
  }

  async addActivity(payload: DealActivityInsert): Promise<DealActivityRow> {
    const { data, error } = await supabase
      .from('activities')
      .insert({
        deal_id:     payload.deal_id,
        type:        payload.type,
        title:       payload.title,
        description: payload.description ?? null,
        created_by:  payload.created_by ?? null,
        status:      'completed',
      })
      .select('id, deal_id, type, title, description, status, created_by, created_at, updated_at')
      .single()
    if (error) throw error
    return data as DealActivityRow
  }

  async deleteActivity(id: string): Promise<void> {
    const { error } = await supabase.from('activities').delete().eq('id', id)
    if (error) throw error
  }
}

export const dealsService = new DealsService()
