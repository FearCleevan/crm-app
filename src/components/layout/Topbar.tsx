import { Bell, Search, Share2, Sun, Moon, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Breadcrumbs } from './Breadcrumbs'
import { ROUTES } from '@/constants/routes'

interface TopbarProps {
  notificationCount?: number
  user?: {
    name: string
    email: string
    role: string
    avatarUrl?: string
  }
  onNotificationsClick?: () => void
  onSearchClick?: () => void
  onLogout?: () => void
  children?: React.ReactNode
}

export function Topbar({
  notificationCount = 0,
  user,
  onNotificationsClick,
  onSearchClick,
  onLogout,
  children,
}: TopbarProps) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = (user?.name ?? 'JW').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  function goTo(route: string) {
    setUserMenuOpen(false)
    navigate(route)
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-5 shrink-0">
      {/* Breadcrumbs (replaces static title) */}
      <Breadcrumbs />

      {/* Extra slot (page action buttons injected via TopbarSlot) */}
      {children}

      {/* Search bar (desktop) */}
      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Open search"
        className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted hover:bg-accent text-muted-foreground text-sm transition-colors min-w-[180px]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search something</span>
        <kbd className="text-[10px] border border-border rounded px-1 py-0.5 bg-card hidden lg:inline">⌘K</kbd>
      </button>

      {/* Search icon (mobile) */}
      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Open search"
        className="md:hidden h-9 w-9 rounded-lg border border-border bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Notifications */}
      <button
        type="button"
        onClick={onNotificationsClick}
        aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
        className="relative h-9 w-9 rounded-lg border border-border bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>

      {/* Share */}
      <button
        type="button"
        aria-label="Share"
        className="hidden sm:flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted hover:bg-accent px-3 text-sm font-medium text-muted-foreground transition-colors"
      >
        <Share2 className="h-4 w-4" />
        <span>Share</span>
      </button>

      {/* Dark mode toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="h-9 w-9 rounded-lg border border-border bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
      >
        {theme === 'dark'
          ? <Sun  className="h-4 w-4 text-amber-500" />
          : <Moon className="h-4 w-4" />
        }
      </button>

      {/* User avatar dropdown */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen(p => !p)}
          aria-label="User menu"
          aria-expanded={userMenuOpen ? 'true' : 'false'}
          className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-accent transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              : initials
            }
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', userMenuOpen && 'rotate-180')} />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-border bg-card shadow-lg py-1 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name ?? 'Janson Williams'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? 'janson@briskcrm.com'}</p>
            </div>
            <div className="py-1">
              <button type="button" onClick={() => goTo(ROUTES.SETTINGS + '?tab=profile')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </button>
              <button type="button" onClick={() => goTo(ROUTES.SETTINGS)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </button>
            </div>
            <div className="border-t border-border py-1">
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); onLogout?.() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
