import { cn } from '@/lib/utils'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  noPad?: boolean
}

export function PageWrapper({ children, className, noPad }: PageWrapperProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto page-enter', !noPad && 'p-6', className)}>
      {children}
    </div>
  )
}
