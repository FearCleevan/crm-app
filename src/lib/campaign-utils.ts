// src/lib/campaign-utils.ts

export const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(date))

export const formatTime = (date: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(date))

export const truncateText = (text: string, maxLen = 50): string =>
  text && text.length > maxLen ? text.slice(0, maxLen) + '...' : (text ?? '')

export const getStatusBadgeClass = (status: string): string => {
  const map: Record<string, string> = {
    draft:        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    active:       'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    paused:       'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    completed:    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    pending:      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    sent:         'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    opened:       'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    clicked:      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
    replied:      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    bounced:      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    unsubscribed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  }
  return map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}
