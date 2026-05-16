import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Handshake, Mail, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

const tabs = [
  { to: ROUTES.DASHBOARD,  icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: ROUTES.PROSPECTS,  icon: Users,            label: 'Prospects' },
  { to: ROUTES.DEALS,      icon: Handshake,        label: 'Deals'     },
  { to: ROUTES.EMAILS,     icon: Mail,             label: 'Emails'    },
  { to: ROUTES.SETTINGS,   icon: Settings,         label: 'Settings'  },
]

export function BottomNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-card border-t border-border flex items-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors',
              isActive
                ? 'text-brand-500'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
