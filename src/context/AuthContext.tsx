import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { signIn as sbSignIn, signOut as sbSignOut, shouldClearSessionOnLoad, markSessionActive } from '@/lib/auth'
import { ROLE_PERMISSIONS, type PermissionKey } from '@/constants/roles'
import { usersService } from '@/services/users.service'
import type { CRMUser } from '@/constants/mockData'

interface AuthContextValue {
  user: CRMUser | null
  role: string
  permissions: PermissionKey[]
  isAuthenticated: boolean
  isLoading: boolean
  needsPasswordSetup: boolean
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
  needsPasswordSetup: false,
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
  const [user, setUser]                         = useState<CRMUser | null>(null)
  const [isLoading, setIsLoading]               = useState(true)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)
  const loginActiveRef                          = useRef(false)

  // ── Session restoration & invite handling ─────────────────────
  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'INITIAL_SESSION') {
          if (!session?.user) {
            setUser(null)
            setNeedsPasswordSetup(false)
          } else {
            // Enforce "remember me = false" — sign out if this is a new browser session
            if (shouldClearSessionOnLoad()) {
              await supabase.auth.signOut()
              if (mounted) { setUser(null); setNeedsPasswordSetup(false); setIsLoading(false) }
              return
            }
            markSessionActive()
            const profile = await fetchProfile(session.user.id)
            if (mounted) {
              setUser(profile)
              setNeedsPasswordSetup(session.user.user_metadata?.needs_password_setup === true)
            }
          }
          if (mounted) setIsLoading(false)
        }

        // Handle sign-in from invite link (not from our login() function)
        if (event === 'SIGNED_IN' && session?.user && !loginActiveRef.current) {
          if (mounted) setIsLoading(true)
          const profile = await fetchProfile(session.user.id)
          if (mounted) {
            setUser(profile)
            setNeedsPasswordSetup(session.user.user_metadata?.needs_password_setup === true)
            setIsLoading(false)
          }
        }

        if (event === 'SIGNED_OUT') {
          if (mounted) { setUser(null); setNeedsPasswordSetup(false); setIsLoading(false) }
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (mounted && profile) setUser(profile)
        }

        // When user updates their password and clears needs_password_setup flag
        if (event === 'USER_UPDATED' && session?.user) {
          if (mounted) {
            setNeedsPasswordSetup(session.user.user_metadata?.needs_password_setup === true)
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ── Login — owns its own outcome, no race with onAuthStateChange ──
  const login = useCallback(async (email: string, password: string, rememberMe = true) => {
    loginActiveRef.current = true
    setIsLoading(true)
    try {
      const { session } = await sbSignIn(email, password, rememberMe)

      if (!session?.user) {
        throw new Error('Login failed — no session returned. Please try again.')
      }

      const profile = await fetchProfile(session.user.id)

      if (!profile) {
        await supabase.auth.signOut()
        throw new Error('Your account is not set up yet. Contact your administrator.')
      }

      setUser(profile)
      setNeedsPasswordSetup(false) // normal login never needs password setup
      usersService.updateLastLogin(profile.id).catch(() => {})
      setIsLoading(false)
    } catch (err) {
      setIsLoading(false)
      throw err
    } finally {
      loginActiveRef.current = false
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
      needsPasswordSetup,
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
