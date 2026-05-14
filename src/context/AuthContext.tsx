import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { signIn as sbSignIn, signOut as sbSignOut } from '@/lib/auth'
import { ROLE_PERMISSIONS, type PermissionKey } from '@/constants/roles'
import type { CRMUser } from '@/constants/mockData'

interface AuthContextValue {
  user: CRMUser | null
  role: string
  permissions: PermissionKey[]
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  hasPermission: (key: PermissionKey) => boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: '',
  permissions: [],
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  hasPermission: () => false,
})

async function fetchProfile(authId: string): Promise<CRMUser | null> {
  const { data, error } = await supabase
    .from('crm_users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle()

  if (error) {
    console.error('[Auth] fetchProfile error:', error.message, error)
    return null
  }
  if (!data) {
    console.warn('[Auth] No crm_users row for auth_id:', authId)
  }
  return (data as CRMUser) ?? null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<CRMUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Session restoration on page refresh ──────────────────────
  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // SIGNED_IN is handled synchronously inside login() below.
        // Here we only care about restoring an existing session on first load
        // and clearing state on sign-out.
        if (event === 'INITIAL_SESSION') {
          if (!session?.user) {
            setUser(null)
          } else {
            const profile = await fetchProfile(session.user.id)
            if (mounted) setUser(profile)
          }
          if (mounted) setIsLoading(false)
        }

        if (event === 'SIGNED_OUT') {
          if (mounted) { setUser(null); setIsLoading(false) }
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Refresh profile silently on token refresh
          const profile = await fetchProfile(session.user.id)
          if (mounted && profile) setUser(profile)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ── Login — owns its own outcome, no race with onAuthStateChange ──
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { session } = await sbSignIn(email, password)

      if (!session?.user) {
        throw new Error('Login failed — no session returned. Please try again.')
      }

      const profile = await fetchProfile(session.user.id)

      if (!profile) {
        // Auth succeeded but no crm_users row exists — clean up and surface error
        await supabase.auth.signOut()
        throw new Error(
          'Your account is not set up yet. Contact your administrator.'
        )
      }

      setUser(profile)
      setIsLoading(false)
    } catch (err) {
      setIsLoading(false)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await sbSignOut()
    setUser(null)
    setIsLoading(false)
  }, [])

  const permissions: PermissionKey[] = user
    ? (ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? [])
    : []

  const hasPermission = useCallback(
    (key: PermissionKey) => permissions.includes(key),
    [permissions]
  )

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role ?? '',
      permissions,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
