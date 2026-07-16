import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'

const DEAL_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
] as const

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerDealTools(server: McpServer) {
  server.tool(
    'list_deals',
    'List deals, optionally filtered by pipeline stage',
    { stage: z.enum(DEAL_STAGES).optional(), limit: z.number().int().min(1).max(200).default(50) },
    async ({ stage, limit }) => {
      let q = supabase
        .from('deals')
        .select('id, name, prospect_name, company, stage, value, probability, expected_close_date')
        .order('sort_order', { ascending: true })
        .limit(limit)
      if (stage) q = q.eq('stage', stage)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool('get_deal', 'Get a single deal by id', { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await supabase.from('deals').select('*').eq('id', id).maybeSingle()
    if (error) return errorResult(error.message)
    if (!data) return errorResult(`No deal found with id ${id}`)
    return jsonResult(data)
  })

  server.tool(
    'update_deal_stage',
    'Move a deal to a different pipeline stage',
    { id: z.string().uuid(), stage: z.enum(DEAL_STAGES) },
    async ({ id, stage }) => {
      const { data, error } = await supabase
        .from('deals')
        .update({ stage, stage_changed_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, name, stage')
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No deal found with id ${id}`)
      return jsonResult(data)
    },
  )

  server.tool(
    'create_deal',
    'Create a new deal',
    {
      name: z.string().min(1),
      prospect_name: z.string().default(''),
      company: z.string().default(''),
      stage: z.enum(DEAL_STAGES).default('New Lead'),
      value: z.number().default(0),
      probability: z.number().int().min(0).max(100).default(10),
      expected_close_date: z.string().describe('YYYY-MM-DD').optional(),
    },
    async ({ name, prospect_name, company, stage, value, probability, expected_close_date }) => {
      const { data, error } = await supabase
        .from('deals')
        .insert({
          name,
          prospect_name,
          company,
          stage,
          value,
          probability,
          ...(expected_close_date ? { expected_close_date } : {}),
        })
        .select('id, name, stage, value')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )
}
