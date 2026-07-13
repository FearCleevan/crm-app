import { formatDate, formatTime } from '@/lib/campaign-utils'

export interface CampaignEvent {
  id: string
  type: 'sent' | 'opened' | 'clicked' | 'replied'
  occurredAt: string
  campaignName: string
}

const EVENT_ICON: Record<CampaignEvent['type'], string> = {
  sent:    '📤',
  opened:  '👁️',
  clicked: '🔗',
  replied: '💬',
}
const EVENT_LABEL: Record<CampaignEvent['type'], string> = {
  sent:    'Email sent via',
  opened:  'Email opened from',
  clicked: 'Link clicked from',
  replied: 'Reply received from',
}

interface Props { events: CampaignEvent[] }

export function CampaignActivityFeed({ events }: Props) {
  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">No campaign activity for this prospect yet.</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">Campaign Activity</p>
      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className="flex items-start gap-3 text-xs">
            <span className="text-base leading-none mt-0.5">{EVENT_ICON[ev.type]}</span>
            <div className="min-w-0">
              <span className="text-muted-foreground">
                {formatDate(ev.occurredAt)} {formatTime(ev.occurredAt)}
              </span>
              <span className="text-foreground ml-1">
                — {EVENT_LABEL[ev.type]} <span className="font-medium">"{ev.campaignName}"</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
