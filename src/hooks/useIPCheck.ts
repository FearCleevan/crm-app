import { useState, useEffect } from 'react'
import { ipService } from '@/services/ip.service'

export interface IPCheckResult {
  allowed: boolean
  loading: boolean
  ip: string
  reason?: string
}

export function useIPCheck(): IPCheckResult {
  const [state, setState] = useState<IPCheckResult>({
    allowed: true,
    loading: true,
    ip: '',
  })

  useEffect(() => {
    ipService
      .checkCurrentIP()
      .then(result => setState({ ...result, loading: false }))
      .catch(() => {
        // EF not deployed or network error — fail open so the app stays accessible
        setState({ allowed: true, loading: false, ip: '' })
      })
  }, [])

  return state
}
