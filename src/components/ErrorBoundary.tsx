import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface State {
  hasError: boolean
  error: Error | null
}

interface Props {
  children: React.ReactNode
  onGoHome?: () => void
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    this.props.onGoHome?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 gap-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Try reloading the page or return to the dashboard.
          </p>
          {this.state.error?.message && (
            <p className="text-xs font-mono text-muted-foreground bg-muted rounded-lg px-3 py-2 mt-3 text-left break-all">
              {this.state.error.message}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={this.handleGoHome}
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Home className="h-4 w-4" /> Go Home
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Reload Page
          </button>
        </div>
      </div>
    )
  }
}
