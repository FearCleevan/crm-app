import { supabase } from '@/lib/supabase'
import type { RichTemplateDB } from '@/types/campaigns'

export async function getTemplates(createdBy: string): Promise<RichTemplateDB[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('created_by', createdBy)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as RichTemplateDB[]
}

export async function createTemplate(data: {
  name: string
  category: string
  subject: string
  body: string
  variables: string[]
  created_by: string
}): Promise<RichTemplateDB> {
  const { data: result, error } = await supabase
    .from('email_templates')
    .insert({ ...data, is_active: true })
    .select()
    .single()
  if (error) throw error
  return result as RichTemplateDB
}

export async function updateTemplate(
  id: string,
  updates: Partial<Pick<RichTemplateDB, 'name' | 'category' | 'subject' | 'body' | 'variables'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function duplicateTemplate(
  id: string,
  createdBy: string
): Promise<RichTemplateDB> {
  const { data: tpl, error: fetchError } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError || !tpl) throw fetchError ?? new Error('Template not found')

  const { id: _id, created_at, updated_at, ...rest } = tpl as RichTemplateDB & {
    created_at: string
    updated_at: string | null
  }

  const { data: result, error } = await supabase
    .from('email_templates')
    .insert({ ...rest, name: `${tpl.name} (Copy)`, created_by: createdBy, is_active: true })
    .select()
    .single()
  if (error) throw error
  return result as RichTemplateDB
}
