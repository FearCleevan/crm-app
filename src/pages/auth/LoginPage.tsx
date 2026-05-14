import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

const loginSchema = z.object({
  email:      z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password:   z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

// Demo credential hints shown on the page
const DEMO_ACCOUNTS = [
  { role: 'Super Admin',  email: 'janson.williams@briskcrm.com', password: 'admin123'   },
  { role: 'Data Analyst', email: 'sarah.chen@briskcrm.com',      password: 'analyst123' },
  { role: 'Agent',        email: 'marcus.torres@briskcrm.com',   password: 'agent123'   },
]

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  async function onSubmit(data: LoginForm) {
    setAuthError(null)
    try {
      await login(data.email, data.password, data.rememberMe)
      // redirect handled by the isAuthenticated guard above once profile loads
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    }
  }

  function fillDemo(email: string, password: string) {
    setValue('email', email)
    setValue('password', password)
    setAuthError(null)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-500 to-violet-500 relative overflow-hidden flex-col justify-between p-12">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
          <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-white/5" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-tight">Brisk CRM</p>
              <p className="text-white/70 text-xs">CR Management Platform</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <blockquote className="space-y-3">
            <p className="text-white/90 text-2xl font-semibold leading-snug">
              "Manage your pipeline,<br/>close more deals."
            </p>
            <p className="text-white/60 text-sm">
              All your prospects, deals, and team activity in one place.
            </p>
          </blockquote>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '50k+', label: 'Prospects' },
              { value: '24%',  label: 'Avg Conversion' },
              { value: '95%',  label: 'Retention Rate' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                <p className="text-white font-bold text-lg">{stat.value}</p>
                <p className="text-white/60 text-xs">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/40 text-xs">
          © {new Date().getFullYear()} Brisk CRM. Internal use only.
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <span className="font-bold text-lg text-foreground">Brisk CRM</span>
        </div>

        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to your account to continue</p>
          </div>

          {/* Auth error banner */}
          {authError && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm">{authError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register('email')}
                className={cn(
                  'w-full h-10 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors',
                  errors.email ? 'border-rose-500 focus:ring-rose-500/30' : 'border-input hover:border-muted-foreground'
                )}
              />
              {errors.email && (
                <p className="text-xs text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={cn(
                    'w-full h-10 rounded-lg border bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors',
                    errors.password ? 'border-rose-500 focus:ring-rose-500/30' : 'border-input hover:border-muted-foreground'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                {...register('rememberMe')}
                className="h-4 w-4 rounded border-input accent-brand-500 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                Remember me for 30 days
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold',
                'flex items-center justify-center gap-2 transition-all',
                'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="space-y-2">
            <p className="text-xs text-center text-muted-foreground">
              ── Demo accounts ──
            </p>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.password)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-dashed border-border hover:bg-accent hover:border-brand-300 transition-all group"
                >
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{acc.role}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{acc.email}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">{acc.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 h-9 w-9 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark'
            ? <span className="text-base">☀️</span>
            : <span className="text-base">🌙</span>
          }
        </button>
      </div>
    </div>
  )
}
