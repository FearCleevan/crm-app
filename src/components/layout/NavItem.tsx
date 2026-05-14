import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NavItemProps {
  to: string
  icon: LucideIcon
  label: string
  badge?: number
  collapsed?: boolean
  end?: boolean
}

export function NavItem({ to, icon: Icon, label, badge, collapsed, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
          'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
          collapsed && 'justify-center px-2'
        )
      }
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              isActive ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground group-hover:text-sidebar-foreground'
            )}
          />
          {!collapsed && (
            <span className="flex-1 truncate">{label}</span>
          )}
          {!collapsed && badge != null && badge > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}
