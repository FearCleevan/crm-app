import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'

const PROSPECT_COLUMNS =
  'id, fullname, firstname, lastname, email, company, jobtitle, city, state, country, status, created_on'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerProspectTools(server: McpServer) {
  server.tool(
    'search_prospects',
    'Search prospects by name, email, or company (case-insensitive partial match)',
    {
      query: z.string().min(1).describe('Search term matched against full name, email, and company'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ query, limit }) => {
      // PostgREST's .or() filter string uses commas to separate conditions and
      // parentheses for grouping, so a literal comma or paren in the search term
      // would break the filter's parsing (or worse, be interpreted as extra
      // filter syntax). Strip them out rather than change search semantics —
      // they're not meaningful characters to match against name/email/company.
      const sanitized = query.replace(/[(),]/g, '')
      const { data, error } = await supabase
        .from('prospects')
        .select(PROSPECT_COLUMNS)
        .or(`fullname.ilike.%${sanitized}%,email.ilike.%${sanitized}%,company.ilike.%${sanitized}%`)
        .limit(limit)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool(
    'get_prospect',
    'Get a single prospect by id',
    { id: z.number().int() },
    async ({ id }) => {
      const { data, error } = await supabase.from('prospects').select('*').eq('id', id).maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No prospect found with id ${id}`)
      return jsonResult(data)
    },
  )

  server.tool(
    'create_prospect',
    'Create a new prospect',
    {
      firstname: z.string().min(1),
      lastname: z.string().min(1),
      email: z.string().email(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).default('New'),
    },
    async ({ firstname, lastname, email, company, jobtitle, status }) => {
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
  )

  server.tool(
    'update_prospect',
    'Update fields on an existing prospect',
    {
      id: z.number().int(),
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      jobtitle: z.string().optional(),
      status: z.enum(['New', 'Contacted', 'Qualified', 'Closed']).optional(),
    },
    async ({ id, ...updates }) => {
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
  )
}
