import { supabase } from '@/lib/supabase'

export type NoteFilter = 'all' | 'deal' | 'prospect' | 'standalone'

export interface NoteRow {
  id: string
  title: string
  description: string | null
  deal_id: string | null
  prospect_id: number | null
  created_by: string
  created_at: string
  updated_at: string
  deals?: { id: string; name: string } | null
  prospects?: { id: string; firstname: string; lastname: string } | null
}

export interface NoteInsert {
  title: string
  description?: string
  deal_id?: string | null
  prospect_id?: number | null
  created_by: string
}

const PAGE_SIZE = 24

export const notesService = {
  async getNotes(
    filter: NoteFilter = 'all',
    search = '',
    page = 0,
  ): Promise<{ data: NoteRow[]; count: number }> {
    let q = supabase
      .from('activities')
      .select(
        'id, title, description, deal_id, prospect_id, created_by, created_at, updated_at, deals(id, name), prospects(id, firstname, lastname)',
        { count: 'exact' },
      )
      .eq('type', 'note')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (filter === 'deal')       q = q.not('deal_id', 'is', null)
    if (filter === 'prospect')   q = q.not('prospect_id', 'is', null).is('deal_id', null)
    if (filter === 'standalone') q = q.is('deal_id', null).is('prospect_id', null)
    if (search.trim())           q = q.ilike('title', `%${search.trim()}%`)

    const { data, error, count } = await q
    if (error) throw error
    return { data: (data as unknown as NoteRow[]) ?? [], count: count ?? 0 }
  },

  async getNotesForProspect(prospectId: number): Promise<NoteRow[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('id, title, description, deal_id, prospect_id, created_by, created_at, updated_at')
      .eq('type', 'note')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as unknown as NoteRow[]) ?? []
  },

  async createNote(payload: NoteInsert): Promise<NoteRow> {
    const { data, error } = await supabase
      .from('activities')
      .insert({ type: 'note', ...payload })
      .select('id, title, description, deal_id, prospect_id, created_by, created_at, updated_at')
      .single()
    if (error) throw error
    return data as unknown as NoteRow
  },

  async updateNote(id: string, payload: { title?: string; description?: string }): Promise<void> {
    const { error } = await supabase
      .from('activities')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async deleteNote(id: string): Promise<void> {
    const { error } = await supabase.from('activities').delete().eq('id', id)
    if (error) throw error
  },
}
