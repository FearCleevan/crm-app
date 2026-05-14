import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'

const SESSION_MINUTES = 10
const WARN_BEFORE_MINUTES = 5
const SESSION_MS   = SESSION_MINUTES * 60_000
const WARN_AFTER_MS = (SESSION_MINUTES - WARN_BEFORE_MINUTES) * 60_000

interface SessionExpiryModalProps {
  onStayLoggedIn: () => void
  onLogout: () => void
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function SessionExpiryModal({ onStayLoggedIn, onLogout }: SessionExpiryModalProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [remaining, setRemaining] = useState(WARN_BEFORE_MINUTES * 60)

  const resetSession = useCallback(() => {
    setShowWarning(false)
    setRemaining(WARN_BEFORE_MINUTES * 60)
  }, [])

  function handleStay() {
    resetSession()
    onStayLoggedIn()
  }

  useEffect(() => {
    const warnTimer = setTimeout(() => setShowWarning(true), WARN_AFTER_MS)
    const expireTimer = setTimeout(() => onLogout(), SESSION_MS)
    return () => {
      clearTimeout(warnTimer)
      clearTimeout(expireTimer)
    }
  // intentionally run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showWarning) return
    const tick = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(tick); return 0 }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [showWarning])

  if (!showWarning) return null

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-5 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Session Expiring Soon</p>
            <p className="text-xs text-muted-foreground">You'll be logged out automatically</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Your session will expire in{' '}
          <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {pad(mins)}:{pad(secs)}
          </span>
          . Would you like to stay logged in?
        </p>

        <div className="flex gap-2">
          <button type="button" onClick={onLogout}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Log Out
          </button>
          <button type="button" onClick={handleStay}
            className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  )
}
