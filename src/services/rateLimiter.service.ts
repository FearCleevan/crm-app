import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export const RATE_LIMITS = {
  login:        { limit: 5,   windowSeconds: 900,  label: 'login attempt' },
  csv_import:   { limit: 3,   windowSeconds: 3600, label: 'CSV import' },
  bulk_delete:  { limit: 5,   windowSeconds: 600,  label: 'bulk delete' },
  add_prospect: { limit: 100, windowSeconds: 3600, label: 'prospect creation' },
  export:       { limit: 10,  windowSeconds: 3600, label: 'export' },
} as const

export type RateLimitEndpoint = keyof typeof RATE_LIMITS

function formatRetryAfter(seconds: number): string {
  if (seconds < 60)   return `${seconds} second${seconds !== 1 ? 's' : ''}`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minute${Math.ceil(seconds / 60) !== 1 ? 's' : ''}`
  return `${Math.ceil(seconds / 3600)} hour${Math.ceil(seconds / 3600) !== 1 ? 's' : ''}`
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}

export const rateLimiter = {
  /**
   * Check and increment the rate limit for an operation.
   * Shows toast warnings automatically.
   * Returns { allowed: false } if the limit has been hit.
   * Fails open (allows through) if the Edge Function is not deployed.
   */
  async check(
    identifier: string,
    endpoint: RateLimitEndpoint,
  ): Promise<RateLimitResult> {
    const { limit, windowSeconds, label } = RATE_LIMITS[endpoint]

    try {
      const { data, error } = await supabase.functions.invoke('rate-limiter', {
        body: { identifier, endpoint, limit, windowSeconds },
      })

      if (error) throw error

      const result = data as { exceeded: boolean; remaining: number; retry_after: number | null }

      if (result.exceeded) {
        const wait = result.retry_after ? ` Try again in ${formatRetryAfter(result.retry_after)}.` : ''
        toast.error(`Rate limit reached for ${label}.${wait}`)
        return { allowed: false, remaining: 0, retryAfter: result.retry_after ?? undefined }
      }

      // Warn when only 1 use remaining
      if (result.remaining === 1) {
        toast.warning(`Last ${label} allowed for this period.`)
      }

      return { allowed: true, remaining: result.remaining }
    } catch {
      // Edge Function not deployed — fail open so the app stays usable
      return { allowed: true, remaining: limit }
    }
  },
}
