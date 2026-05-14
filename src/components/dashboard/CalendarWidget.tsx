import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'

const MOCK_EVENTS = [
  {
    id: 'e1',
    title: 'Mesh Weekly Meeting',
    time: '9:00 am – 10:00 am',
    platform: 'Google Meet',
    platformColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    attendees: ['JW', 'SC', 'MT'],
    date: new Date(),
  },
  {
    id: 'e2',
    title: 'Available Time',
    time: '10:00 am – 10:40 am',
    platform: null,
    platformColor: '',
    attendees: [],
    date: new Date(),
  },
  {
    id: 'e3',
    title: 'Patreon Gamification Demo',
    time: '10:45 am – 11:45 am',
    platform: 'Slack',
    platformColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    attendees: ['JW', 'SC'],
    date: new Date(),
  },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const AVATAR_COLORS = ['bg-brand-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500']

export function CalendarWidget() {
  const [current, setCurrent] = useState(new Date())
  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad   = getDay(monthStart) // 0=Sun

  function prevMonth() { setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4 flex flex-col h-full">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Calendar</p>
        <div className="flex items-center gap-1">
          <select
            value={format(current, 'MMMM')}
            onChange={() => {}}
            className="text-xs font-medium text-foreground bg-transparent border-none focus:outline-none cursor-pointer"
          >
            <option>{format(current, 'MMMM')}</option>
          </select>
          <div className="flex gap-0.5">
            <button onClick={prevMonth} aria-label="Previous month" className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center transition-colors">
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={nextMonth} aria-label="Next month" className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center transition-colors">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}

        {/* Padding cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {/* Day cells */}
        {days.map(day => {
          const hasEvent = MOCK_EVENTS.some(e => isSameDay(e.date, day))
          const todayFlag = isToday(day)
          return (
            <button
              key={day.toISOString()}
              className={cn(
                'relative h-7 w-full rounded-md text-xs font-medium transition-colors flex items-center justify-center',
                todayFlag
                  ? 'bg-brand-500 text-white font-bold'
                  : 'text-foreground hover:bg-accent'
              )}
            >
              {format(day, 'd')}
              {hasEvent && !todayFlag && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-brand-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Events */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {MOCK_EVENTS.map(ev => (
          <div key={ev.id} className="flex gap-3">
            {/* Time column */}
            <div className="w-20 shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground leading-tight">{ev.time.split('–')[0].trim()}</p>
            </div>

            {/* Event card */}
            <div className="flex-1 min-w-0 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/50 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-foreground truncate">{ev.title}</p>
              <p className="text-[10px] text-muted-foreground">{ev.time}</p>

              {(ev.attendees.length > 0 || ev.platform) && (
                <div className="flex items-center justify-between">
                  {/* Attendee avatars */}
                  {ev.attendees.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {ev.attendees.slice(0, 4).map((initials, i) => (
                        <div
                          key={i}
                          className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-card', AVATAR_COLORS[i % AVATAR_COLORS.length])}
                        >
                          {initials}
                        </div>
                      ))}
                      {ev.attendees.length > 4 && (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground ring-2 ring-card">
                          +{ev.attendees.length - 4}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Platform badge */}
                  {ev.platform && (
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', ev.platformColor)}>
                      {ev.platform} →
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
