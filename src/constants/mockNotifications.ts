export type NotificationCategory = 'mention' | 'assignment' | 'system'
export type NotificationIcon = 'import' | 'deal' | 'task' | 'user' | 'system' | 'alert'

export interface AppNotification {
  id: string
  category: NotificationCategory
  icon: NotificationIcon
  title: string
  message: string
  time: string
  read: boolean
  link?: string
}

const now = Date.now()
const mins = (m: number) => new Date(now - m * 60_000).toISOString()
const hrs  = (h: number) => new Date(now - h * 3_600_000).toISOString()
const days = (d: number) => new Date(now - d * 86_400_000).toISOString()

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    category: 'system',
    icon: 'import',
    title: 'New leads imported',
    message: '150 new leads were imported from Apollo. Review them in Prospects.',
    time: mins(4),
    read: false,
    link: '/prospects',
  },
  {
    id: 'n2',
    category: 'assignment',
    icon: 'deal',
    title: 'Deal won: Acme Corp',
    message: 'Sarah Mitchell closed "Acme Corp — Enterprise Deal" for $85,000.',
    time: mins(22),
    read: false,
    link: '/deals',
  },
  {
    id: 'n3',
    category: 'assignment',
    icon: 'task',
    title: 'Task overdue',
    message: 'Follow-up call with TechNova Inc. was due 2 hours ago.',
    time: hrs(2),
    read: false,
    link: '/deals',
  },
  {
    id: 'n4',
    category: 'mention',
    icon: 'user',
    title: 'You were mentioned',
    message: 'James Reyes mentioned you in a note on prospect "Liam Torres".',
    time: hrs(3),
    read: true,
    link: '/prospects',
  },
  {
    id: 'n5',
    category: 'system',
    icon: 'system',
    title: 'System maintenance',
    message: 'Scheduled maintenance window on Saturday 11pm–1am AEST.',
    time: hrs(5),
    read: true,
  },
  {
    id: 'n6',
    category: 'assignment',
    icon: 'user',
    title: 'New user joined',
    message: 'Priya Sharma accepted the invitation and joined as Agent.',
    time: days(1),
    read: true,
    link: '/users',
  },
  {
    id: 'n7',
    category: 'system',
    icon: 'alert',
    title: 'Workflow failed',
    message: '"Follow-up if No Response" workflow encountered an error on 3 prospects.',
    time: days(1),
    read: true,
    link: '/workflows',
  },
  {
    id: 'n8',
    category: 'mention',
    icon: 'user',
    title: 'Comment on your deal',
    message: 'Alice Chen commented on "GlobalTech — Enterprise Deal": "Following up next week".',
    time: days(2),
    read: true,
    link: '/deals',
  },
]
