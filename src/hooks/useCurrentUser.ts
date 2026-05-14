import { useAuth } from '@/context/AuthContext'

export function useCurrentUser() {
  const { user, role, permissions, isAuthenticated, isLoading } = useAuth()
  return { user, role, permissions, isAuthenticated, isLoading }
}
