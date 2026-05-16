import { useState, useEffect, useCallback, Suspense } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'
import { TopbarProvider, useTopbar } from '@/context/TopbarContext'
import { NotificationPanel, useNotifications } from '@/components/notifications/NotificationPanel'
import { CommandPalette } from '@/components/search/CommandPalette'
import { QuickActionFab } from './QuickActionFab'
import { SessionExpiryModal } from './SessionExpiryModal'
import { ForcePasswordModal } from '@/components/auth/ForcePasswordModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/ui/PageLoader'
import { ROUTES } from '@/constants/routes'
import { supabase } from '@/lib/supabase'

interface AppShellProps {
  user?: {
    name: string
    email: string
    role: string
    avatarUrl?: string
  }
  onLogout?: () => void
}

function ShellInner({ user, onLogout }: AppShellProps) {
  const { actions } = useTopbar()
  const navigate = useNavigate()

  const [notifOpen, setNotifOpen]       = useState(false)
  const [paletteOpen, setPaletteOpen]   = useState(false)
  const [sessionKey, setSessionKey]     = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleStayLoggedIn = useCallback(async () => {
    await supabase.auth.refreshSession()
    setSessionKey(k => k + 1)
  }, [])

  const {
    notifications,
    markRead,
    markAllRead,
    remove: removeNotif,
    clearAll,
    unreadCount,
  } = useNotifications()

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        user={user}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          notificationCount={unreadCount}
          user={user}
          onLogout={onLogout}
          onSearchClick={() => setPaletteOpen(true)}
          onNotificationsClick={() => setNotifOpen(true)}
          onMobileMenuClick={() => setMobileNavOpen(true)}
        >
          {actions}
        </Topbar>

        <main className="flex-1 flex flex-col overflow-hidden pb-14 lg:pb-0">
          <ErrorBoundary onGoHome={() => navigate(ROUTES.DASHBOARD)}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <BottomNav />

      {/* Notification panel */}
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onDelete={removeNotif}
        onClearAll={clearAll}
      />

      {/* Command palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />

      {/* Quick action FAB */}
      <QuickActionFab />

      {/* Session expiry warning — key forces remount (resets timers) when user stays logged in */}
      <SessionExpiryModal
        key={sessionKey}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={onLogout ?? (() => {})}
      />

      {/* Force invited users to create a password before using the app */}
      <ForcePasswordModal />
    </div>
  )
}

export function AppShell(props: AppShellProps) {
  return (
    <TopbarProvider>
      <ShellInner {...props} />
    </TopbarProvider>
  )
}
