import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormValues = z.infer<typeof schema>

type PageStatus = 'loading' | 'form' | 'success' | 'error'

export function AcceptInvitePage() {
  const { theme, toggleTheme } = useTheme()
  const [status, setStatus]       = useState<PageStatus>('loading')
  const [email, setEmail]         = useState('')
  const [errorMsg, setErrorMsg]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    // Read the type from the URL hash BEFORE Supabase clears it
    const hash   = window.location.hash
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const type   = params.get('type')

    if (type !== 'invite') {
      setErrorMsg('This link is invalid or has already been used. Please request a new invitation.')
      setStatus('error')
      return
    }

    // Listen for Supabase to process the hash tokens and create the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user?.email) {
        setEmail(session.user.email)
        setStatus('form')
      }
    })

    // Fallback: session may already be set if hash was processed synchronously
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setEmail(session.user.email)
        setStatus('form')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function onSubmit(data: FormValues) {
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      // Sign out so the user authenticates fresh with their new password
      await supabase.auth.signOut()
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to set password. Please try again.')
    }
  }

  const inputCls = (err?: boolean) => cn(
    'w-full h-10 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors',
    err ? 'border-rose-500 focus:ring-rose-500/30' : 'border-input hover:border-muted-foreground',
  )

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left branding panel ── */}
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
            <p className="text-white/70 text-xs">CR Management Platform</p>
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
            Set a secure password to activate your account and start using Brisk CRM.
          </p>
        </div>

        <p className="relative z-10 text-white/40 text-xs">
          © {new Date().getFullYear()} Brisk CRM. Internal use only.
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <span className="font-bold text-lg text-foreground">Brisk CRM</span>
        </div>

        <div className="w-full max-w-sm">

          {/* ── Loading ── */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
              <p className="text-sm text-muted-foreground">Verifying invitation…</p>
            </div>
          )}

          {/* ── Error ── */}
          {status === 'error' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">Invalid Link</h2>
                <p className="text-sm text-muted-foreground">This invitation link cannot be used.</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700 dark:text-rose-400">{errorMsg}</p>
              </div>
              <Link to={ROUTES.LOGIN}
                className="block w-full h-10 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors text-center leading-10">
                Back to Login
              </Link>
            </div>
          )}

          {/* ── Password form ── */}
          {status === 'form' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">Set your password</h2>
                <p className="text-sm text-muted-foreground">Create a password to activate your account</p>
              </div>

              {/* Invited email badge */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
                <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300 shrink-0">
                  {email[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-brand-600 dark:text-brand-400 font-medium">Invited as</p>
                  <p className="text-sm font-semibold text-foreground truncate">{email}</p>
                </div>
              </div>

              {/* Submit error */}
              {errorMsg && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 dark:text-rose-400">{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min. 6 characters"
                      {...register('password')}
                      className={inputCls(!!errors.password)}
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-rose-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{errors.password.message}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConf ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      {...register('confirmPassword')}
                      className={inputCls(!!errors.confirmPassword)}
                    />
                    <button type="button" onClick={() => setShowConf(p => !p)}
                      aria-label={showConf ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-rose-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button type="submit" disabled={isSubmitting}
                  className={cn(
                    'w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold',
                    'flex items-center justify-center gap-2 transition-all',
                    'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                  )}>
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Setting password…</>
                  ) : (
                    'Activate Account'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── Success ── */}
          {status === 'success' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">Account Activated!</h2>
                  <p className="text-sm text-muted-foreground">
                    Your password has been set. You can now sign in to Brisk CRM.
                  </p>
                </div>
              </div>
              <Link to={ROUTES.LOGIN}
                className={cn(
                  'w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold',
                  'flex items-center justify-center transition-all hover:bg-primary/90',
                )}>
                Go to Login
              </Link>
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <button onClick={toggleTheme}
          className="absolute top-4 right-4 h-9 w-9 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
          aria-label="Toggle dark mode">
          {theme === 'dark' ? <span className="text-base">☀️</span> : <span className="text-base">🌙</span>}
        </button>
      </div>
    </div>
  )
}
