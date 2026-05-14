import { useState, useEffect, useRef } from 'react'
import { X, Check, Trash2, Package, Briefcase, CheckSquare, User, Settings, AlertTriangle, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { MOCK_NOTIFICATIONS, type AppNotification, type NotificationCategory } from '@/constants/mockNotifications'

const ICON_MAP: Record<AppNotification['icon'], React.ElementType> = {
  import:  Upload,
  deal:    Briefcase,
  task:    CheckSquare,
  user:    User,
  system:  Settings,
  alert:   AlertTriangle,
}

const ICON_COLOR: Record<AppNotification['icon'], string> = {
  import:  'text-brand-500 bg-brand-100 dark:bg-brand-900/30',
  deal:    'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
  task:    'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  user:    'text-violet-600 bg-violet-100 dark:bg-violet-900/30',
  system:  'text-slate-500 bg-slate-100 dark:bg-slate-800',
  alert:   'text-rose-500 bg-rose-100 dark:bg-rose-900/30',
}

type Tab = 'all' | NotificationCategory

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'mention',    label: 'Mentions' },
  { id: 'assignment', label: 'Assignments' },
  { id: 'system',     label: 'System' },
]

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  notifications: AppNotification[]
  onMarkAllRead: () => void
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

export function NotificationPanel({
  open,
  onClose,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onDelete,
  onClearAll,
}: NotificationPanelProps) {
  const [tab, setTab] = useState<Tab>('all')
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = notifications.filter(n => tab === 'all' || n.category === tab)
  const unread = notifications.filter(n => !n.read).length

  function handleItemClick(n: AppNotification) {
    onMarkRead(n.id)
    if (n.link) { navigate(n.link); onClose() }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications"
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-sm z-50 bg-card border-l border-border shadow-2xl flex flex-col',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            {unread > 0 && (
              <span className="h-5 min-w-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button type="button" onClick={onMarkAllRead}
                className="flex items-center gap-1 h-7 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Mark all as read">
                <Check className="h-3.5 w-3.5" /> All read
              </button>
            )}
            {notifications.length > 0 && (
              <button type="button" onClick={onClearAll}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-rose-500 transition-colors"
                title="Clear all">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={onClose}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
              aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border shrink-0 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn(
                'h-7 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Package className="h-8 w-8 opacity-20" />
              <p className="text-sm font-medium">All caught up</p>
              <p className="text-xs">No notifications here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(n => {
                const Icon = ICON_MAP[n.icon]
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors group relative',
                      !n.read && 'bg-brand-50/50 dark:bg-brand-950/10',
                    )}
                    onClick={() => handleItemClick(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && handleItemClick(n)}
                  >
                    {!n.read && (
                      <span className="absolute top-4 left-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                    )}
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', ICON_COLOR[n.icon])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm truncate', n.read ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onDelete(n.id) }}
                      aria-label="Remove notification"
                      className="text-muted-foreground hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(MOCK_NOTIFICATIONS)

  function markRead(id: string) {
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifications(p => p.map(n => ({ ...n, read: true })))
  }

  function remove(id: string) {
    setNotifications(p => p.filter(n => n.id !== id))
  }

  function clearAll() {
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, markRead, markAllRead, remove, clearAll, unreadCount }
}
