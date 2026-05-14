import { supabase } from '@/lib/supabase'
import type { CRMUserRow } from '@/types/database'

export const usersService = {
  async getUsers() {
    const { data, error } = await supabase
      .from('crm_users')
      .select('*')
      .order('first_name', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as CRMUserRow[]
  },

  async getUser(id: string) {
    const { data, error } = await supabase
      .from('crm_users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data as CRMUserRow
  },

  async updateUser(id: string, updates: Partial<CRMUserRow>) {
    const { data, error } = await supabase
      .from('crm_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as CRMUserRow
  },

  async updateRole(id: string, role: CRMUserRow['role']) {
    const { data, error } = await supabase
      .from('crm_users')
      .update({ role })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as CRMUserRow
  },

  async setActive(id: string, is_active: boolean) {
    const { data, error } = await supabase
      .from('crm_users')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as CRMUserRow
  },

  async updateLastLogin(id: string) {
    await supabase
      .from('crm_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id)
  },
}
