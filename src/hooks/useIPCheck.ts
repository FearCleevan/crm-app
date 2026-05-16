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
    const failOpen = new Promise<{ allowed: boolean; ip: string }>(resolve =>
      setTimeout(() => resolve({ allowed: true, ip: '' }), 4000)
    )

    Promise.race([ipService.checkCurrentIP(), failOpen])
      .then(result => setState({ ...result, loading: false }))
      .catch(() => setState({ allowed: true, loading: false, ip: '' }))
  }, [])

  return state
}
