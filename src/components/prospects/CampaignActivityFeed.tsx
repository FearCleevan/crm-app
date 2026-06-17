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

// Mock feed — in backend phase this comes from email_events
export const MOCK_CAMPAIGN_EVENTS: CampaignEvent[] = [
  { id: '1', type: 'sent',    occurredAt: '2026-06-10T10:00:00Z', campaignName: 'US Small Business Outreach' },
  { id: '2', type: 'opened',  occurredAt: '2026-06-11T14:30:00Z', campaignName: 'US Small Business Outreach' },
  { id: '3', type: 'clicked', occurredAt: '2026-06-11T14:31:00Z', campaignName: 'US Small Business Outreach' },
  { id: '4', type: 'replied', occurredAt: '2026-06-14T09:00:00Z', campaignName: 'US Small Business Outreach' },
]

interface Props { events?: CampaignEvent[] }

export function CampaignActivityFeed({ events = MOCK_CAMPAIGN_EVENTS }: Props) {
  if (events.length === 0) return null
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
