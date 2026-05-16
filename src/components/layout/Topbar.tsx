import { Bell, Search, Share2, Sun, Moon, ChevronDown, LogOut, User, Settings, Menu, Plus, X, UserPlus, Briefcase, Phone, FileText } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Breadcrumbs } from './Breadcrumbs'
import { ROUTES } from '@/constants/routes'

const QUICK_ACTIONS = [
  { id: 'prospect', label: 'Add Prospect', icon: UserPlus, color: 'bg-emerald-500 text-white hover:bg-emerald-600', route: ROUTES.PROSPECTS },
  { id: 'deal',     label: 'Add Deal',     icon: Briefcase, color: 'bg-amber-500 text-white hover:bg-amber-600',   route: ROUTES.DEALS    },
  { id: 'call',     label: 'Log Call',     icon: Phone,    color: 'bg-blue-500 text-white hover:bg-blue-600'                               },
  { id: 'note',     label: 'Add Note',     icon: FileText, color: 'bg-violet-500 text-white hover:bg-violet-600'                           },
]

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
  onMobileMenuClick?: () => void
  onLogout?: () => void
  children?: React.ReactNode
}

export function Topbar({
  notificationCount = 0,
  user,
  onNotificationsClick,
  onSearchClick,
  onMobileMenuClick,
  onLogout,
  children,
}: TopbarProps) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const quickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = (user?.name ?? 'JW').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  function goTo(route: string) {
    setUserMenuOpen(false)
    navigate(route)
  }

  function handleQuickAction(action: typeof QUICK_ACTIONS[number]) {
    setQuickOpen(false)
    if (action.route) {
      navigate(action.route)
      toast.info(`Use the button on the page to ${action.label.toLowerCase()}`)
    } else {
      toast.success(`${action.label} recorded`)
    }
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center gap-2 px-4 shrink-0">
      {/* Hamburger — far left on mobile/tablet */}
      <button
        type="button"
        onClick={onMobileMenuClick}
        aria-label="Open menu"
        className="lg:hidden h-9 w-9 rounded-lg border border-border bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors shrink-0"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Breadcrumbs — desktop only */}
      <div className="hidden lg:block">
        <Breadcrumbs />
      </div>

      {/* Extra slot (page action buttons injected via TopbarSlot) */}
      {children}

      {/* Spacer — pushes all right-side icons to the far right */}
      <div className="flex-1" />

      {/* Search bar (desktop) */}
      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Open search"
        className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted hover:bg-accent text-muted-foreground text-sm transition-colors min-w-[180px]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search something</span>
        <kbd className="text-[10px] border border-border rounded px-1 py-0.5 bg-card">⌘K</kbd>
      </button>

      {/* Search icon (mobile + tablet) */}
      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Open search"
        className="lg:hidden h-9 w-9 rounded-lg border border-border bg-muted hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
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

      {/* Share — desktop only */}
      <button
        type="button"
        aria-label="Share"
        className="hidden lg:flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted hover:bg-accent px-3 text-sm font-medium text-muted-foreground transition-colors"
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

      {/* Quick actions + button — mobile/tablet only */}
      <div ref={quickRef} className="relative lg:hidden">
        <button
          type="button"
          onClick={() => setQuickOpen(v => !v)}
          aria-label="Quick actions"
          aria-expanded={quickOpen}
          className="h-9 w-9 rounded-lg border border-border bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground transition-colors"
        >
          {quickOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>

        {quickOpen && (
          <div className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-border bg-card shadow-lg py-1.5 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            {QUICK_ACTIONS.map(action => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent transition-colors text-left"
                >
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', action.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* User avatar dropdown */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen(p => !p)}
          aria-label="User menu"
          aria-expanded={userMenuOpen ? 'true' : 'false'}
          className="flex items-center gap-1.5 h-9 pl-1 pr-2 rounded-lg hover:bg-accent transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              : initials
            }
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform hidden lg:block', userMenuOpen && 'rotate-180')} />
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
