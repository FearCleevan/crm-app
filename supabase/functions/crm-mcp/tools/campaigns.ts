import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import { MCP_CRM_USER_ID } from '../config.ts'
import type { ToolDef } from './types.ts'
import { extractTemplateVariables } from './templateVariables.ts'

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export const campaignTools: ToolDef[] = [
  {
    name: 'list_campaigns',
    description: 'List email campaigns, optionally filtered by status',
    schema: { status: z.enum(['draft', 'active', 'paused', 'completed']).optional() },
    handler: async ({ status }) => {
      let q = supabase
        .from('email_campaigns')
        .select('id, name, status, daily_limit, total_recipients, total_sent, created_at')
        .order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'get_campaign',
    description: 'Get a single campaign by id',
    schema: { id: z.string().uuid() },
    handler: async ({ id }) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*, email_templates(name, subject)')
        .eq('id', id)
        .maybeSingle()
      if (error) return errorResult(error.message)
      if (!data) return errorResult(`No campaign found with id ${id}`)
      return jsonResult(data)
    },
  },
  {
    name: 'create_campaign',
    description: 'Create a new email campaign (status starts as draft)',
    schema: {
      name: z.string().min(1),
      description: z.string().optional(),
      template_id: z.string().uuid().optional(),
      daily_limit: z.number().int().min(10).max(500).default(50),
    },
    handler: async ({ name, description, template_id, daily_limit }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in Supabase Edge Function Secrets — set it to a real crm_users.id before creating campaigns.',
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
  },
  {
    name: 'activate_campaign',
    description:
      'Activate a draft/paused campaign so it starts sending real emails via the dispatch-campaign-batch cron job. Requires confirm: true.',
    schema: { id: z.string().uuid(), confirm: z.boolean().default(false) },
    handler: async ({ id, confirm }) => {
      const { count, error: countErr } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('status', 'pending')
      if (countErr) return errorResult(countErr.message)
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
  },
  {
    name: 'list_campaign_recipients',
    description: 'List the recipients of a campaign and their send status',
    schema: { campaign_id: z.string().uuid() },
    handler: async ({ campaign_id }) => {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('id, prospect_id, status, sent_at, opened_at, clicked_at, replied_at, bounced_at')
        .eq('campaign_id', campaign_id)
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'create_email_template',
    description:
      'Create a reusable email template. Merge-field placeholders like {{first_name}} and {{company}} in the body are detected automatically.',
    schema: {
      name: z.string().min(1),
      category: z.enum([
        'general', 'follow_up', 'introduction', 'proposal', 'closing',
        're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
      ]).default('general'),
      subject: z.string().min(1),
      body: z.string().min(1),
    },
    handler: async ({ name, category, subject, body }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in Supabase Edge Function Secrets — set it to a real crm_users.id before creating templates.',
        )
      }
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name,
          category,
          subject,
          body,
          created_by: MCP_CRM_USER_ID,
          is_active: true,
          variables: extractTemplateVariables(body),
        })
        .select('id, name, category, subject, variables, created_at')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'list_email_templates',
    description: 'List active email templates, optionally filtered by category',
    schema: {
      category: z.enum([
        'general', 'follow_up', 'introduction', 'proposal', 'closing',
        're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
      ]).optional(),
    },
    handler: async ({ category }) => {
      let q = supabase
        .from('email_templates')
        .select('id, name, category, subject, variables, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (category) q = q.eq('category', category)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
]
