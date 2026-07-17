import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import type { ToolDef } from './types.ts'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const workflowTools: ToolDef[] = [
  {
    name: 'list_workflows',
    description: 'List all workflows (read-only — there is no execution engine to trigger runs yet)',
    schema: {},
    handler: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, description, status, trigger, run_count, last_run')
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'get_workflow_runs',
    description: 'Get the run log for a single workflow',
    schema: { workflow_id: z.string().uuid() },
    handler: async ({ workflow_id }) => {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('id, status, record_label, record_link, duration, error, created_at')
        .eq('workflow_id', workflow_id)
        .order('created_at', { ascending: false })
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
]
