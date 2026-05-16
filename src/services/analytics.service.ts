import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/components/reports/ReportDateRangePicker'

// ── Date helper ───────────────────────────────────────────────
export function getDateFrom(range: DateRange): string {
  const now = new Date()
  switch (range) {
    case 'today':   return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    case '7d':      return new Date(Date.now() - 7 * 86_400_000).toISOString()
    case '30d':     return new Date(Date.now() - 30 * 86_400_000).toISOString()
    case 'month':   return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString()
    case 'year':    return new Date(now.getFullYear(), 0, 1).toISOString()
  }
}

// ── Types ─────────────────────────────────────────────────────
export interface DashboardMetrics {
  total_prospects:  number
  new_this_week:    number
  new_today:        number
  qualified_count:  number
  closed_won_count: number
  avg_deal_size:    number
  total_revenue:    number
}

export interface RevenuePoint { month: string; value: number }

export interface LeadsBreakdown {
  by_status:      { status: string; count: number }[]
  by_provider:    { code: string; count: number }[]
  by_disposition: { code: string; count: number }[]
}

export interface CountryPoint { country: string; count: number }

export interface FunnelData {
  total:     number
  contacted: number
  qualified: number
  proposals: number
  won:       number
}

export interface LeadsReportData {
  by_provider:    { code: string; count: number }[]
  by_disposition: { code: string; count: number }[]
  by_user: {
    user_id:   string
    name:      string
    email:     string
    role:      string
    leads:     number
    contacted: number
    qualified: number
  }[]
}

export interface ActivityBreakdown {
  by_type:        { type: string; count: number }[]
  by_day:         { day: string; dow: number; calls: number; emails: number; notes: number; tasks: number }[]
  total_calls:    number
  total_emails:   number
  total_notes:    number
  total_meetings: number
}

export interface UserPerformanceStat {
  user_id:     string
  first_name:  string | null
  last_name:   string | null
  email:       string
  role:        string
  profile_url: string | null
  leads:       number
  deals:       number
  revenue:     number
  activities:  number
}

export interface SegmentPoint {
  month:      string
  smes:       number
  midmarket:  number
  enterprise: number
}

// ── Service ───────────────────────────────────────────────────
class AnalyticsService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const { data, error } = await supabase.rpc('get_dashboard_metrics')
    if (error) throw error
    return data as DashboardMetrics
  }

  async getRevenueByMonth(monthsBack = 24): Promise<RevenuePoint[]> {
    const { data, error } = await supabase.rpc('get_revenue_by_month', { months_back: monthsBack })
    if (error) throw error
    return (data ?? []) as RevenuePoint[]
  }

  async getLeadsBreakdown(): Promise<LeadsBreakdown> {
    const { data, error } = await supabase.rpc('get_leads_breakdown')
    if (error) throw error
    return (data ?? { by_status: [], by_provider: [], by_disposition: [] }) as LeadsBreakdown
  }

  async getCountryDistribution(limitN = 10): Promise<CountryPoint[]> {
    const { data, error } = await supabase.rpc('get_country_distribution', { limit_n: limitN })
    if (error) throw error
    return (data ?? []) as CountryPoint[]
  }

  async getConversionFunnel(dateRange: DateRange): Promise<FunnelData> {
    const { data, error } = await supabase.rpc('get_conversion_funnel', { date_from: getDateFrom(dateRange) })
    if (error) throw error
    return (data ?? { total: 0, contacted: 0, qualified: 0, proposals: 0, won: 0 }) as FunnelData
  }

  async getLeadsReportData(dateRange: DateRange): Promise<LeadsReportData> {
    const { data, error } = await supabase.rpc('get_leads_report_data', { date_from: getDateFrom(dateRange) })
    if (error) throw error
    return (data ?? { by_provider: [], by_disposition: [], by_user: [] }) as LeadsReportData
  }

  async getActivityBreakdown(dateRange: DateRange): Promise<ActivityBreakdown> {
    const { data, error } = await supabase.rpc('get_activity_breakdown', { date_from: getDateFrom(dateRange) })
    if (error) throw error
    return (data ?? {
      by_type: [], by_day: [],
      total_calls: 0, total_emails: 0, total_notes: 0, total_meetings: 0,
    }) as ActivityBreakdown
  }

  async getUserPerformanceStats(): Promise<UserPerformanceStat[]> {
    const { data, error } = await supabase.rpc('get_user_performance_stats')
    if (error) throw error
    return (data ?? []) as UserPerformanceStat[]
  }

  async getProspectSegmentsByMonth(monthsBack = 6): Promise<SegmentPoint[]> {
    const { data, error } = await supabase.rpc('get_prospect_segments_by_month', { months_back: monthsBack })
    if (error) throw error
    return (data ?? []) as SegmentPoint[]
  }
}

export const analyticsService = new AnalyticsService()
