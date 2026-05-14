import { useState, useEffect, Suspense } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TopbarProvider, useTopbar } from '@/context/TopbarContext'
import { NotificationPanel, useNotifications } from '@/components/notifications/NotificationPanel'
import { CommandPalette } from '@/components/search/CommandPalette'
import { QuickActionFab } from './QuickActionFab'
import { SessionExpiryModal } from './SessionExpiryModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoader } from '@/components/ui/PageLoader'
import { ROUTES } from '@/constants/routes'

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

  const [notifOpen, setNotifOpen]     = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

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
      <Sidebar user={user} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          notificationCount={unreadCount}
          user={user}
          onLogout={onLogout}
          onSearchClick={() => setPaletteOpen(true)}
          onNotificationsClick={() => setNotifOpen(true)}
        >
          {actions}
        </Topbar>

        <main className="flex-1 flex flex-col overflow-hidden">
          <ErrorBoundary onGoHome={() => navigate(ROUTES.DASHBOARD)}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

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

      {/* Session expiry warning */}
      <SessionExpiryModal
        onStayLoggedIn={() => {/* session refresh placeholder */}}
        onLogout={onLogout ?? (() => {})}
      />
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
