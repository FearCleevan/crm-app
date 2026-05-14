import { AlertTriangle } from 'lucide-react'
import type { Blocker } from 'react-router-dom'

interface UnsavedChangesGuardProps {
  blocker: Blocker
}

/**
 * Renders a confirmation modal when react-router navigation is blocked due to unsaved changes.
 * Pair with useUnsavedChanges() to get the blocker.
 */
export function UnsavedChangesGuard({ blocker }: UnsavedChangesGuardProps) {
  if (blocker.state !== 'blocked') return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => blocker.reset()} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Unsaved Changes</p>
            <p className="text-xs text-muted-foreground">You have changes that haven't been saved</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          If you leave this page your unsaved changes will be lost. Are you sure you want to continue?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => blocker.reset()}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Stay on Page
          </button>
          <button
            type="button"
            onClick={() => blocker.proceed()}
            className="flex-1 h-9 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors"
          >
            Leave Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
