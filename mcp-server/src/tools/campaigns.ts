import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabase } from '../supabaseClient.js'
import { MCP_CRM_USER_ID } from '../config.js'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerCampaignTools(server: McpServer) {
  server.tool(
    'list_campaigns',
    'List email campaigns, optionally filtered by status',
    { status: z.enum(['draft', 'active', 'paused', 'completed']).optional() },
    async ({ status }) => {
      let q = supabase
        .from('email_campaigns')
        .select('id, name, status, daily_limit, total_recipients, total_sent, created_at')
        .order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool('get_campaign', 'Get a single campaign by id', { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*, email_templates(name, subject)')
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResult(error.message)
    if (!data) return errorResult(`No campaign found with id ${id}`)
    return jsonResult(data)
  })

  server.tool(
    'create_campaign',
    'Create a new email campaign (status starts as draft)',
    {
      name: z.string().min(1),
      description: z.string().optional(),
      template_id: z.string().uuid().optional(),
      daily_limit: z.number().int().min(10).max(500).default(50),
    },
    async ({ name, description, template_id, daily_limit }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in .env.local — set it to a real crm_users.id before creating campaigns.',
        )
      }
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: MCP_CRM_USER_ID,
          name,
          description: description ?? null,
          template_id: template_id ?? null,
          daily_limit,
        })
        .select('id, name, status')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )

  server.tool(
    'activate_campaign',
    'Activate a draft/paused campaign so it starts sending real emails via the dispatch-campaign-batch cron job. Requires confirm: true.',
    { id: z.string().uuid(), confirm: z.boolean().default(false) },
    async ({ id, confirm }) => {
      const { count, error: countErr } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('status', 'pending')
      if (countErr) return errorResult(countErr.message)
      // count can come back null (without an error) in edge cases — e.g. certain
      // RLS/head-query interactions. This is the one human-facing safety prompt
      // in the server, so never let a null count silently render as "0 pending
      // recipients" and mislead someone into confirming activation. Treat an
      // indeterminate count the same as an error: bail out rather than show a
      // number that might be wrong.
      if (count === null) {
        return errorResult(
          `Could not determine the number of pending recipients for campaign ${id} ` +
            `(count query returned null). Refusing to proceed with activation until this can be verified.`,
        )
      }

      if (!confirm) {
        return errorResult(
          `Activating campaign ${id} will start sending real emails to ${count} pending recipients ` +
            `(picked up by the dispatch-campaign-batch cron job within 15 minutes). Re-call with confirm: true to proceed.`,
        )
      }

      const { data: existing, error: fetchErr } = await supabase
        .from('email_campaigns')
        .select('id, status')
        .eq('id', id)
        .maybeSingle()
      if (fetchErr) return errorResult(fetchErr.message)
      if (!existing) return errorResult(`No campaign found with id ${id}`)
      if (existing.status === 'active' || existing.status === 'completed') {
        return errorResult(
          `Campaign ${id} is already "${existing.status}" — refusing to re-activate. ` +
            `Only draft or paused campaigns can be activated.`,
        )
      }

      const { data, error } = await supabase
        .from('email_campaigns')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, name, status')
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No campaign found with id ${id}`)
      return jsonResult(data)
    },
  )

  server.tool(
    'list_campaign_recipients',
    'List the recipients of a campaign and their send status',
    { campaign_id: z.string().uuid() },
    async ({ campaign_id }) => {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('id, prospect_id, status, sent_at, opened_at, clicked_at, replied_at, bounced_at')
        .eq('campaign_id', campaign_id)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  )
}
