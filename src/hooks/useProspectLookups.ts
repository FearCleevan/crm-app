import { useState, useEffect } from 'react'
import { prospectsService } from '@/services/prospects.service'
import type {
  DispositionRow, EmailStatusRow, ProviderRow,
  CountryRow, IndustryRow,
} from '@/types/database'

interface Lookups {
  dispositions: DispositionRow[]
  emailStatuses: EmailStatusRow[]
  providers: ProviderRow[]
  countries: CountryRow[]
  industries: IndustryRow[]
}

const empty: Lookups = {
  dispositions: [], emailStatuses: [],
  providers: [], countries: [], industries: [],
}

export function useProspectLookups() {
  const [data, setData]       = useState<Lookups>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    prospectsService.getLookups()
      .then(result => { setData(result as Lookups); setLoading(false) })
      .catch(err => { setError(err); setLoading(false) })
  }, [])

  return { ...data, loading, error }
}
