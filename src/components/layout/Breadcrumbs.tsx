import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard:  'Dashboard',
  prospects:  'Prospects',
  deals:      'Deals',
  notes:      'Notes',
  emails:     'Emails',
  reports:    'Reports',
  workflows:  'Workflows',
  users:      'User Management',
  settings:   'Settings',
  help:       'Help Center',
  '403':      'Forbidden',
}

interface Crumb {
  label: string
  to: string
  current: boolean
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ label: 'Dashboard', to: '/dashboard', current: true }]

  const crumbs: Crumb[] = segments.map((seg, i) => {
    const to = '/' + segments.slice(0, i + 1).join('/')
    const isId = /^[0-9a-f-]{8,}$|^\d+$/.test(seg)
    const label = isId
      ? 'Detail'
      : (SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1))
    return { label, to, current: i === segments.length - 1 }
  })

  return crumbs
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const crumbs = buildCrumbs(pathname)

  if (crumbs.length <= 1) {
    return (
      <h1 className="text-base font-semibold text-foreground mr-auto">
        {crumbs[0]?.label ?? 'Paul CRM'}
      </h1>
    )
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 mr-auto text-sm overflow-hidden">
      <Link to="/dashboard" aria-label="Home" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.to} className="flex items-center gap-1 min-w-0">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          {crumb.current ? (
            <span className={cn('font-semibold text-foreground truncate', i > 0 && 'max-w-[160px]')}>
              {crumb.label}
            </span>
          ) : (
            <Link to={crumb.to} className={cn('text-muted-foreground hover:text-foreground transition-colors truncate', 'max-w-[120px]')}>
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
