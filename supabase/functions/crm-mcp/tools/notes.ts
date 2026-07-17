import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import { MCP_CRM_USER_ID } from '../config.ts'
import type { ToolDef } from './types.ts'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const noteTools: ToolDef[] = [
  {
    name: 'list_notes',
    description: 'List notes attached to a prospect (notes are stored as activities with type=note)',
    schema: { prospect_id: z.number().int() },
    handler: async ({ prospect_id }) => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, title, description, created_by, created_at')
        .eq('type', 'note')
        .eq('prospect_id', prospect_id)
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'add_note',
    description: 'Add a note to a prospect',
    schema: { prospect_id: z.number().int(), title: z.string().min(1), description: z.string().optional() },
    handler: async ({ prospect_id, title, description }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in Supabase Edge Function Secrets — set it before adding notes, so notes are attributed correctly instead of silently written with created_by: null.',
        )
      }
      const { data, error } = await supabase
        .from('activities')
        .insert({
          type: 'note',
          title,
          description: description ?? null,
          prospect_id,
          created_by: MCP_CRM_USER_ID,
        })
        .select('id, title, description, created_at')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
]
