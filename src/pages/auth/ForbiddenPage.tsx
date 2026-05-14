import { useNavigate } from 'react-router-dom'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export function ForbiddenPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
          <ShieldX className="h-10 w-10 text-rose-500" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-rose-500 tracking-widest uppercase">403 Forbidden</p>
          <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to view this page. Contact your administrator
            if you believe this is a mistake.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent text-sm font-medium text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
