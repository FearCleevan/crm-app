import { supabase } from '@/lib/supabase'

export interface EmailDraft {
  id: number
  user_id: string
  to_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  subject: string | null
  body: string | null
  template_id: string | null
  prospect_id: number | null
  created_at: string
  updated_at: string
}

export interface DraftInput {
  user_id: string
  to_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  subject: string
  body: string
  template_id: string | null
  prospect_id: number | null
}

export const draftsService = {
  async listDrafts(userId: string): Promise<EmailDraft[]> {
    const { data, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async createDraft(input: DraftInput): Promise<EmailDraft> {
    const { data, error } = await supabase
      .from('email_drafts')
      .insert(input)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data
  },

  async updateDraft(id: number, input: Partial<DraftInput>): Promise<void> {
    const { error } = await supabase
      .from('email_drafts')
      .update(input)
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async deleteDraft(id: number): Promise<void> {
    const { error } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
