import { z } from 'npm:zod@4'
import { supabase } from '../supabaseClient.ts'
import type { ToolDef } from './types.ts'

const REPORT_TYPES = [
  'dashboard_metrics',
  'revenue_by_month',
  'leads_breakdown',
  'conversion_funnel',
  'activity_breakdown',
] as const

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function getDateFrom(range: '7d' | '30d' | 'month' | 'quarter' | 'year'): string {
  const now = new Date()
  switch (range) {
    case '7d':      return new Date(Date.now() - 7 * 86_400_000).toISOString()
    case '30d':     return new Date(Date.now() - 30 * 86_400_000).toISOString()
    case 'month':   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString()
    case 'year':    return new Date(now.getFullYear(), 0, 1).toISOString()
  }
}

export const reportTools: ToolDef[] = [
  {
    name: 'get_report',
    description:
      'Get one of the CRM dashboard reports: dashboard_metrics, revenue_by_month, leads_breakdown, conversion_funnel, activity_breakdown',
    schema: {
      type: z.enum(REPORT_TYPES),
      date_range: z.enum(['7d', '30d', 'month', 'quarter', 'year']).default('30d'),
    },
    handler: async ({ type, date_range }) => {
      const dateFrom = getDateFrom(date_range)
      switch (type) {
        case 'dashboard_metrics': {
          const { data, error } = await supabase.rpc('get_dashboard_metrics')
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'revenue_by_month': {
          const { data, error } = await supabase.rpc('get_revenue_by_month', { months_back: 12 })
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'leads_breakdown': {
          const { data, error } = await supabase.rpc('get_leads_breakdown')
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'conversion_funnel': {
          const { data, error } = await supabase.rpc('get_conversion_funnel', { date_from: dateFrom })
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        case 'activity_breakdown': {
          const { data, error } = await supabase.rpc('get_activity_breakdown', { date_from: dateFrom })
          if (error) return errorResult(error.message)
          return jsonResult(data)
        }
        default:
          return errorResult(`Unknown report type: ${type}`)
      }
    },
  },
]
