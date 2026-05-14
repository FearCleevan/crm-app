import { useAuth } from '@/context/AuthContext'
import type { PermissionKey } from '@/constants/roles'

interface PermissionGateProps {
  permission: PermissionKey
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { hasPermission } = useAuth()
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>
}
