import { useState, useEffect } from 'react'
import {
  analyticsService,
  type DashboardMetrics,
  type RevenuePoint,
  type LeadsBreakdown,
  type CountryPoint,
  type SegmentPoint,
} from '@/services/analytics.service'

export interface DashboardData {
  loading:     boolean
  metrics:     DashboardMetrics | null
  revenueData: RevenuePoint[]
  breakdown:   LeadsBreakdown
  countries:   CountryPoint[]
  segments:    SegmentPoint[]
}

const EMPTY_BREAKDOWN: LeadsBreakdown = { by_status: [], by_provider: [], by_disposition: [] }

export function useDashboardData(): DashboardData {
  const [state, setState] = useState<DashboardData>({
    loading:     true,
    metrics:     null,
    revenueData: [],
    breakdown:   EMPTY_BREAKDOWN,
    countries:   [],
    segments:    [],
  })

  useEffect(() => {
    let cancelled = false

    Promise.all([
      analyticsService.getDashboardMetrics(),
      analyticsService.getRevenueByMonth(24),
      analyticsService.getLeadsBreakdown(),
      analyticsService.getCountryDistribution(10),
      analyticsService.getProspectSegmentsByMonth(6),
    ])
      .then(([metrics, revenueData, breakdown, countries, segments]) => {
        if (!cancelled) {
          setState({ loading: false, metrics, revenueData, breakdown, countries, segments })
        }
      })
      .catch(() => {
        if (!cancelled) setState(prev => ({ ...prev, loading: false }))
      })

    return () => { cancelled = true }
  }, [])

  return state
}
