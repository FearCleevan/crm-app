import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserBadgeProps {
  name: string
  email: string
  role: string
  avatarUrl?: string
  collapsed?: boolean
  className?: string
}

const roleColors: Record<string, string> = {
  'Super Admin': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Data Analyst': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Agent':        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

export function UserBadge({ name, email, role, avatarUrl, collapsed, className }: UserBadgeProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <div className="relative shrink-0">
        <div className="h-8 w-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden ring-2 ring-white dark:ring-sidebar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-sidebar" />
      </div>

      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">{name}</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-brand-500 shrink-0">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.491 4.491 0 0 1-3.497-1.307 4.491 4.491 0 0 1-1.307-3.497A4.49 4.49 0 0 1 2.25 12a4.49 4.49 0 0 1 1.549-3.397 4.491 4.491 0 0 1 1.307-3.497 4.491 4.491 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground truncate">{email}</span>
          </div>
          <span className={cn('mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full', roleColors[role] ?? 'bg-gray-100 text-gray-600')}>
            {role}
          </span>
        </div>
      )}

      {!collapsed && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </div>
  )
}
