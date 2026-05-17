import { useState, useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AlertCircle, KeyRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { PageLoader } from '@/components/ui/PageLoader'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

export function AcceptInvitePage() {
  const { theme, toggleTheme } = useTheme()
  const { isAuthenticated, isLoading } = useAuth()

  // React Router's location.hash is immune to Supabase's history.replaceState() cleanup
  // (replaceState doesn't fire popstate, so React Router never re-reads the URL).
  const { hash } = useLocation()

  const params   = new URLSearchParams(hash.replace(/^#/, ''))
  const hasToken = params.has('access_token')
  const hasError = params.has('error')

  // Stay in loading state while AuthContext is loading OR while waiting for
  // the SIGNED_IN event after an invite token is processed.
  const [waiting, setWaiting] = useState(hasToken && !hasError)

  useEffect(() => {
    if (!hasToken || hasError) { setWaiting(false); return }
    // Give AuthContext time to process SIGNED_IN and load the profile
    const timer = setTimeout(() => setWaiting(false), 8000)
    return () => clearTimeout(timer)
  }, [hasToken, hasError])

  // Authenticated → go to dashboard (ForcePasswordModal handles password creation there)
  if (!isLoading && isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  // Show spinner while AuthContext is initialising or invite token is being processed
  if (isLoading || waiting) {
    return <PageLoader message="Setting up your account…" />
  }

  // Not authenticated & done waiting → error state
  const errorCode = params.get('error_code')
  const rawDesc   = params.get('error_description') ?? ''
  const errorDesc = rawDesc ? decodeURIComponent(rawDesc.replace(/\+/g, ' ')) : ''

  let errorMessage: string
  if (errorCode === 'otp_expired') {
    errorMessage = "This invitation link has expired. If you've already set your password, please log in normally. Otherwise, contact your administrator for a new invitation."
  } else if (errorDesc) {
    errorMessage = errorDesc
  } else {
    errorMessage = 'This invitation link is invalid or has already been used. Please request a new invitation from your administrator.'
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-500 to-violet-500 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
          <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-white/5" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-tight">Brisk CRM</p>
            <p className="text-white/70 text-xs">Customer Relationship Management</p>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <KeyRound className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-white font-bold text-3xl leading-snug">
            You've been<br />invited to join.
          </h2>
          <p className="text-white/60 text-sm max-w-xs">
            Accept your invitation to start collaborating with your team on Brisk CRM.
          </p>
        </div>

        <p className="relative z-10 text-white/40 text-xs">
          © {new Date().getFullYear()} Brisk CRM. Internal use only.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <span className="font-bold text-lg text-foreground">Brisk CRM</span>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Invalid Link</h2>
            <p className="text-sm text-muted-foreground">This invitation link cannot be used.</p>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 dark:text-rose-400">{errorMessage}</p>
          </div>

          <Link to={ROUTES.LOGIN}
            className={cn(
              'block w-full h-10 rounded-lg border border-border text-sm font-medium',
              'text-muted-foreground hover:bg-accent transition-colors text-center leading-10',
            )}>
            Back to Login
          </Link>
        </div>

        <button onClick={toggleTheme}
          className="absolute top-4 right-4 h-9 w-9 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
          aria-label="Toggle dark mode">
          {theme === 'dark' ? <span className="text-base">☀️</span> : <span className="text-base">🌙</span>}
        </button>
      </div>
    </div>
  )
}
