import { useAuth } from '@/context/AuthContext'
import type { PermissionKey } from '@/constants/roles'

export function usePermissions() {
  const { permissions, hasPermission, role } = useAuth()
  return { permissions, hasPermission, role }
}

export function useHasPermission(key: PermissionKey): boolean {
  const { hasPermission } = useAuth()
  return hasPermission(key)
}
