import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, AlertCircle, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
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

const inputCls = (err?: boolean) => cn(
  'w-full h-10 rounded-lg border bg-background px-3 text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
  err ? 'border-rose-500' : 'border-input hover:border-muted-foreground',
)

export function ForcePasswordModal() {
  const { user, needsPasswordSetup, logout } = useAuth()
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  })

  if (!needsPasswordSetup) return null

  async function onSubmit(data: FormValues) {
    setServerError('')
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
        data: { needs_password_setup: false },
      })
      if (error) throw error
      toast.success('Password created! Welcome to Paul CRM.')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to set password. Please try again.')
    }
  }

  async function handleCancel() {
    await logout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Non-dismissible backdrop — clicking does nothing */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">

        {/* Coloured header */}
        <div className="bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Welcome to Paul CRM!</h2>
              <p className="text-white/70 text-xs mt-0.5">Create a password to continue to your dashboard</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Invited email */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
            <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-xs font-bold text-brand-700 dark:text-brand-300 shrink-0 uppercase">
              {user?.email?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">Invited as</p>
              <p className="text-sm font-semibold text-foreground truncate">{user?.email}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            To continue to the dashboard, please create a secure password for your account.
          </p>

          {serverError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
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
                <p className="text-[11px] text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />{errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
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
                <p className="text-[11px] text-rose-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />{errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
              >
                {isSubmitting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating…</>
                  : 'Create Password'}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-muted-foreground text-center">
            Clicking Cancel will sign you out. You can accept the invite again later.
          </p>
        </div>
      </div>
    </div>
  )
}
