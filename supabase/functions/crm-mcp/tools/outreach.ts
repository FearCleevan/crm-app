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

export const outreachTools: ToolDef[] = [
  {
    name: 'send_outreach_email',
    description:
      'Send a single outreach email to a prospect immediately (not via a campaign). Requires confirm: true.',
    schema: {
      prospect_id: z.number().int(),
      subject: z.string().min(1),
      body: z.string().min(1),
      confirm: z.boolean().default(false),
    },
    handler: async ({ prospect_id, subject, body, confirm }) => {
      if (!confirm) {
        return errorResult(
          `Sending this email to prospect ${prospect_id} will dispatch a real message immediately, ` +
            `with no delay to catch a mistake. Re-call with confirm: true to proceed.`,
        )
      }

      const { data: prospect, error: prospectErr } = await supabase
        .from('prospects')
        .select('id, email, fullname')
        .eq('id', prospect_id)
        .maybeSingle()
      if (prospectErr) return errorResult(prospectErr.message)
      if (!prospect) return errorResult(`No prospect found with id ${prospect_id}`)
      if (!prospect.email) return errorResult(`Prospect ${prospect_id} has no email address on file`)

      const resendKey = Deno.env.get('RESEND_API_KEY')
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'
      if (!resendKey) {
        return errorResult('RESEND_API_KEY not set — add it in Supabase Edge Function Secrets')
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Brisk CRM <${fromEmail}>`,
          to: [prospect.email],
          subject,
          html: body,
        }),
      })

      const resendData = await resendRes.json().catch(() => null)
      if (!resendRes.ok) {
        return errorResult(resendData?.message ?? `Resend returned ${resendRes.status}`)
      }

      // Deliberately not checking MCP_CRM_USER_ID for null here (unlike add_note/create_campaign):
      // the email has already been sent, and this log write is best-effort (console.warn only on
      // failure), so we don't want to fail a successfully-sent email over a missing attribution id.
      const { error: actErr } = await supabase.from('activities').insert({
        type: 'email',
        title: subject,
        description: `Outreach sent to: ${prospect.email}`,
        prospect_id,
        created_by: MCP_CRM_USER_ID,
      })
      if (actErr) console.warn('[send_outreach_email] activity log failed:', actErr.message)

      return jsonResult({ sent: true, to: prospect.email, resend_id: resendData?.id ?? null })
    },
  },
]
