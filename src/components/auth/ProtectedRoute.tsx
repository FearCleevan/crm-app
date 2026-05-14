import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { PermissionKey } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { PageLoader } from '@/components/ui/PageLoader'

interface ProtectedRouteProps {
  requiredPermission?: PermissionKey
}

export function ProtectedRoute({ requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth()

  if (isLoading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />
  }

  return <Outlet />
}
