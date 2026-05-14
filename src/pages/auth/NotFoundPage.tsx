import { useNavigate } from 'react-router-dom'
import { SearchX, Home } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Illustration */}
        <div className="relative mx-auto w-40 h-32">
          <div className="absolute inset-0 rounded-2xl bg-brand-100 dark:bg-brand-900/20" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <SearchX className="h-16 w-16 text-brand-400" strokeWidth={1.2} />
          </div>
          <div className="absolute -bottom-1 -right-2 text-5xl font-black text-brand-200 dark:text-brand-800 select-none">
            404
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Page Not Found</h1>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        <button
          onClick={() => navigate(ROUTES.DASHBOARD)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
        >
          <Home className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
