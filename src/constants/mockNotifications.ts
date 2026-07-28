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
