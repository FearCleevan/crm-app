interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message }: PageLoaderProps = {}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 bg-background">
      {/* Spinning arc around the logo */}
      <div className="relative flex items-center justify-center">
        <svg
          className="absolute h-[72px] w-[72px] animate-spin"
          viewBox="0 0 72 72"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="36"
            cy="36"
            r="32"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="50 151"
            className="text-brand-500"
          />
        </svg>

        {/* Paul "P" logo mark */}
        <div className="h-12 w-12 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <span className="text-white font-bold text-[22px] leading-none select-none">P</span>
        </div>
      </div>

      {/* Three bouncing dots */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" />
      </div>

      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
