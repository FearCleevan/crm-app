import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import type { ToolDef } from './types.ts'

const PROSPECT_COLUMNS =
  'id, fullname, firstname, lastname, email, company, jobtitle, city, state, country, status, created_on'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const prospectTools: ToolDef[] = [
  {
    name: 'search_prospects',
    description: 'Search prospects by name, email, or company (case-insensitive partial match)',
    schema: {
      query: z.string().min(1).describe('Search term matched against full name, email, and company'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    handler: async ({ query, limit }) => {
      const sanitized = query.replace(/[(),]/g, '')
      const { data, error } = await supabase
        .from('prospects')
        .select(PROSPECT_COLUMNS)
        .or(`fullname.ilike.%${sanitized}%,email.ilike.%${sanitized}%,company.ilike.%${sanitized}%`)
        .limit(limit)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'get_prospect',
    description: 'Get a single prospect by id',
    schema: { id: z.number().int() },
    handler: async ({ id }) => {
      const { data, error } = await supabase.from('prospects').select('*').eq('id', id).maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No prospect found with id ${id}`)
      return jsonResult(data)
    },
  },
  {
    name: 'create_prospect',
    description: 'Create a new prospect',
    schema: {
      firstname: z.string().min(1),
      lastname: z.string().min(1),
      email: z.string().email(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).default('New'),
    },
    handler: async ({ firstname, lastname, email, company, jobtitle, status }) => {
      const { data, error } = await supabase
        .from('prospects')
        .insert({
          firstname,
          lastname,
          fullname: `${firstname} ${lastname}`,
          email,
          company: company ?? null,
          jobtitle: jobtitle ?? null,
          status,
        })
        .select(PROSPECT_COLUMNS)
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'update_prospect',
    description: 'Update fields on an existing prospect',
    schema: {
      id: z.number().int(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).optional(),
    },
    handler: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('prospects')
        .update({ ...updates, updated_on: new Date().toISOString() })
        .eq('id', id)
        .select(PROSPECT_COLUMNS)
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No prospect found with id ${id}`)
      return jsonResult(data)
    },
  },
]
