import { Star, Paperclip, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EmailMessage } from '@/constants/mockEmails'

function timeLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)    return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)     return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)     return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const LABEL_COLORS: Record<string, string> = {
  important:   'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  lead:        'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'closed-won':'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
}

interface EmailListProps {
  emails: EmailMessage[]
  selectedId: string | null
  onSelect: (email: EmailMessage) => void
  onToggleStar: (id: string) => void
  onDelete?: (id: string) => void
}

export function EmailList({ emails, selectedId, onSelect, onToggleStar, onDelete }: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
        <p className="text-sm">No emails here</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {emails.map(email => (
        <div
          key={email.id}
          onClick={() => onSelect(email)}
          className={cn(
            'flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors group',
            selectedId === email.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-muted/40',
            !email.read && 'bg-blue-50/50 dark:bg-blue-950/10',
          )}
        >
          {/* Avatar */}
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
            {email.from.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row */}
            <div className="flex items-center gap-2">
              <span className={cn('text-sm truncate flex-1', !email.read ? 'font-bold text-foreground' : 'font-medium text-foreground/80')}>
                {email.from.name}
              </span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{timeLabel(email.date)}</span>
            </div>

            {/* Subject */}
            <p className={cn('text-sm truncate mt-0.5', !email.read ? 'font-semibold text-foreground' : 'text-foreground/70')}>
              {email.subject}
            </p>

            {/* Preview + meta */}
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground truncate flex-1">{email.preview}</p>
              <div className="flex items-center gap-1 shrink-0">
                {email.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground/60" />}
                {email.labels?.map(l => (
                  <span key={l} className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', LABEL_COLORS[l] ?? 'bg-muted text-muted-foreground')}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Row actions */}
          <div className="flex items-center gap-1 mt-1 shrink-0">
            {onDelete && (
              <button
                type="button"
                aria-label="Delete"
                onClick={e => { e.stopPropagation(); onDelete(email.id) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground/40 hover:text-rose-500" />
              </button>
            )}
            <button
              type="button"
              aria-label={email.starred ? 'Unstar' : 'Star'}
              onClick={e => { e.stopPropagation(); onToggleStar(email.id) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Star className={cn('h-4 w-4', email.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40 hover:text-amber-400')} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
