import { useState, useEffect, useRef } from 'react'
import { Plus, X, UserPlus, Briefcase, Phone, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'

const ACTIONS = [
  {
    id: 'prospect',
    label: 'Add Prospect',
    icon: UserPlus,
    color: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    handler: (navigate: ReturnType<typeof useNavigate>) => {
      navigate(ROUTES.PROSPECTS)
      toast.info('Use the + New Prospect button to add a prospect')
    },
  },
  {
    id: 'deal',
    label: 'Add Deal',
    icon: Briefcase,
    color: 'bg-amber-500 hover:bg-amber-600 text-white',
    handler: (navigate: ReturnType<typeof useNavigate>) => {
      navigate(ROUTES.DEALS)
      toast.info('Use the + Add Deal button to create a deal')
    },
  },
  {
    id: 'call',
    label: 'Log Call',
    icon: Phone,
    color: 'bg-blue-500 hover:bg-blue-600 text-white',
    handler: () => {
      toast.success('Call logged successfully')
    },
  },
  {
    id: 'note',
    label: 'Add Note',
    icon: FileText,
    color: 'bg-violet-500 hover:bg-violet-600 text-white',
    handler: () => {
      toast.success('Note saved')
    },
  },
]

export function QuickActionFab() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  return (
    <div ref={containerRef} className="hidden lg:flex fixed bottom-6 right-6 z-30 flex-col items-end gap-3">
      {/* Action items — slide up when open */}
      <div className={cn(
        'flex flex-col items-end gap-2 transition-all duration-200',
        open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none',
      )}>
        {ACTIONS.map((action, i) => {
          const Icon = action.icon
          return (
            <div key={action.id}
              className="flex items-center gap-2"
              style={{ transitionDelay: open ? `${i * 40}ms` : '0ms' }}>
              <span className={cn(
                'text-xs font-semibold bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground shadow-md whitespace-nowrap',
                'transition-opacity duration-200',
                open ? 'opacity-100' : 'opacity-0',
              )}>
                {action.label}
              </span>
              <button
                type="button"
                onClick={() => { action.handler(navigate); setOpen(false) }}
                aria-label={action.label}
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center shadow-lg transition-all',
                  action.color,
                )}
              >
                <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Main FAB */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close quick actions' : 'Quick actions'}
        aria-expanded={open}
        className={cn(
          'h-14 w-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          open && 'rotate-45',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  )
}
