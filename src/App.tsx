import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForbiddenPage } from '@/pages/auth/ForbiddenPage'
import { NotFoundPage } from '@/pages/auth/NotFoundPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProspectsPage } from '@/pages/ProspectsPage'
import { DealsPage } from '@/pages/DealsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { EmailsPage } from '@/pages/EmailsPage'
import { WorkflowsPage } from '@/pages/WorkflowsPage'
import { UserManagementPage } from '@/pages/UserManagementPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ROUTES } from '@/constants/routes'
import type { PermissionKey } from '@/constants/roles'

function PlaceholderPage({ name }: { name: string }) {
  return (
    <PageWrapper>
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <div className="h-12 w-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
          <span className="text-2xl">🚧</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{name}</h2>
        <p className="text-sm text-muted-foreground">This page will be built in an upcoming phase.</p>
      </div>
    </PageWrapper>
  )
}

function AuthenticatedShell() {
  const { user, logout } = useAuth()
  return (
    <AppShell
      user={user ? {
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        avatarUrl: user.profile_url,
      } : undefined}
      onLogout={logout}
    />
  )
}

// Data router — required for useBlocker (unsaved-changes guard) and future loader/action support
const router = createBrowserRouter([
  // Public
  { path: ROUTES.LOGIN,     element: <LoginPage /> },
  { path: ROUTES.FORBIDDEN, element: <ForbiddenPage /> },

  // Root redirect
  { path: '/', element: <Navigate to={ROUTES.DASHBOARD} replace /> },

  // Protected — requires authentication
  {
    element: <ProtectedRoute />,
    children: [{
      element: <AuthenticatedShell />,
      children: [
        // Accessible to all authenticated users
        { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
        { path: '/notes',         element: <PlaceholderPage name="Notes" /> },
        { path: '/help',          element: <PlaceholderPage name="Help Center" /> },
        { path: ROUTES.SETTINGS,  element: <SettingsPage /> },

        // Requires leads_view
        {
          element: <ProtectedRoute requiredPermission={'leads_view' as PermissionKey} />,
          children: [
            { path: ROUTES.PROSPECTS, element: <ProspectsPage /> },
            { path: '/prospects/:id', element: <PlaceholderPage name="Prospect Detail" /> },
          ],
        },

        // Requires deals_view
        {
          element: <ProtectedRoute requiredPermission={'deals_view' as PermissionKey} />,
          children: [
            { path: ROUTES.DEALS, element: <DealsPage /> },
          ],
        },

        // Requires emails_view
        {
          element: <ProtectedRoute requiredPermission={'emails_view' as PermissionKey} />,
          children: [
            { path: ROUTES.EMAILS, element: <EmailsPage /> },
          ],
        },

        // Requires reports_view (Agents don't have this)
        {
          element: <ProtectedRoute requiredPermission={'reports_view' as PermissionKey} />,
          children: [
            { path: ROUTES.REPORTS, element: <ReportsPage /> },
          ],
        },

        // Requires workflows_view (Agents don't have this)
        {
          element: <ProtectedRoute requiredPermission={'workflows_view' as PermissionKey} />,
          children: [
            { path: ROUTES.WORKFLOWS, element: <WorkflowsPage /> },
          ],
        },

        // Requires users_view (Super Admin only)
        {
          element: <ProtectedRoute requiredPermission={'users_view' as PermissionKey} />,
          children: [
            { path: ROUTES.USERS, element: <UserManagementPage /> },
          ],
        },
      ],
    }],
  },

  // 404
  { path: '*', element: <NotFoundPage /> },
])

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </AuthProvider>
    </ThemeProvider>
  )
}
