import { supabase } from '@/lib/supabase'
import type { NotificationRow } from '@/types/database'

export const notificationsService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    return (data ?? []) as NotificationRow[]
  },

  async markRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async markAllRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw new Error(error.message)
  },

  async remove(id: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async clearAll(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
  },
}
