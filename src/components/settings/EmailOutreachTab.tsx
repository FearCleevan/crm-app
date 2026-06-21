import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOutreachSettings } from '@/hooks/useOutreachSettings'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const TIMEZONES = ['Asia/Manila','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Australia/Sydney']

function buildWarmupData(limit: number) {
  const daysToRamp = Math.ceil(limit / 10)
  return Array.from({ length: daysToRamp }, (_, i) => ({
    day: `Day ${i + 1}`,
    emails: Math.min((i + 1) * 10, limit),
  }))
}

export function EmailOutreachTab() {
  const { user } = useCurrentUser()
  const { settings, saving, save } = useOutreachSettings(user?.id ?? null)

  const [senderName,    setSenderName]    = useState('Peter Lazan')
  const [senderEmail,   setSenderEmail]   = useState('peter@lazandev.dev')
  const [dailyLimit,    setDailyLimit]    = useState(50)
  const [fromHour,      setFromHour]      = useState(9)
  const [toHour,        setToHour]        = useState(17)
  const [timezone,      setTimezone]      = useState('Asia/Manila')
  const [sendDays,      setSendDays]      = useState<string[]>(['Mon','Tue','Wed','Thu','Fri'])
  const [warmup,        setWarmup]        = useState(false)
  const [unsubFooter,   setUnsubFooter]   = useState(true)
  const [unsubText,     setUnsubText]     = useState('To unsubscribe from these emails, reply with "unsubscribe".')

  useEffect(() => {
    setSenderName(settings.sender_name)
    setSenderEmail(settings.sender_email)
    setDailyLimit(settings.daily_limit)
    setFromHour(settings.send_from_hour)
    setToHour(settings.send_to_hour)
    setSendDays(settings.send_days)
    setWarmup(settings.warmup_enabled)
    setUnsubFooter(settings.unsubscribe_footer)
    setUnsubText(settings.unsubscribe_text)
  }, [settings])

  function toggleDay(day: string) {
    setSendDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  async function handleSave() {
    if (fromHour >= toHour) {
      toast.error('Send window start time must be before end time.')
      return
    }
    try {
      await save({
        sender_name:        senderName,
        sender_email:       senderEmail,
        daily_limit:        dailyLimit,
        send_from_hour:     fromHour,
        send_to_hour:       toHour,
        send_days:          sendDays,
        warmup_enabled:     warmup,
        unsubscribe_footer: unsubFooter,
        unsubscribe_text:   unsubText,
      })
      toast.success('Outreach settings saved')
    } catch {
      toast.error('Failed to save settings')
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 || 12
    const ampm = i < 12 ? 'AM' : 'PM'
    return { value: i, label: `${String(h).padStart(2,'0')}:00 ${ampm}` }
  })

  return (
    <div className="max-w-2xl space-y-6">

      {/* Sender Identity */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Sender Identity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Sender Name</label>
            <input value={senderName} onChange={e => setSenderName(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Sender Email</label>
            <input type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
      </section>

      {/* Daily Send Controls */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Daily Send Controls</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Daily Limit</label>
            <span className="text-xs font-bold text-foreground">{dailyLimit} emails/day</span>
          </div>
          <input type="range" min={10} max={500} step={5} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))}
            className="w-full accent-primary" aria-label="Daily send limit" />
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>10</span><span>500</span></div>
          {dailyLimit > 200 && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">High volume may trigger spam filters.</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">From</label>
            <select value={fromHour} onChange={e => setFromHour(Number(e.target.value))} aria-label="Send window start"
              className="w-full h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">To</label>
            <select value={toHour} onChange={e => setToHour(Number(e.target.value))} aria-label="Send window end"
              className="w-full h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {hours.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} aria-label="Timezone"
              className="w-full h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Sending Days */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Sending Days</h3>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)} aria-label={`Toggle ${day}`}
              className={`h-9 w-14 rounded-lg text-xs font-semibold border transition-colors ${sendDays.includes(day) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-accent'}`}>
              {day}
            </button>
          ))}
        </div>
      </section>

      {/* Warm-up */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Warm-up Mode</h3>
          <button type="button" role="switch" aria-checked={warmup} onClick={() => setWarmup(p => !p)}
            className={`h-5 w-9 rounded-full border-2 transition-colors relative ${warmup ? 'bg-primary border-primary' : 'bg-muted border-border'}`}>
            <span className={`absolute top-0 h-4 w-4 rounded-full bg-white shadow transition-transform ${warmup ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Enable gradual warm-up — ramps send volume to limit over {Math.ceil(dailyLimit / 10)} days</p>
        {warmup && (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={buildWarmupData(dailyLimit)}>
              <XAxis dataKey="day" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip />
              <Bar dataKey="emails" fill="var(--color-brand-500, #3b82f6)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Unsubscribe Footer */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Unsubscribe Footer</h3>
          <button type="button" role="switch" aria-checked={unsubFooter} onClick={() => setUnsubFooter(p => !p)}
            className={`h-5 w-9 rounded-full border-2 transition-colors relative ${unsubFooter ? 'bg-primary border-primary' : 'bg-muted border-border'}`}>
            <span className={`absolute top-0 h-4 w-4 rounded-full bg-white shadow transition-transform ${unsubFooter ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        {unsubFooter && (
          <textarea value={unsubText} onChange={e => setUnsubText(e.target.value)} rows={2}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        )}
      </section>

      <button type="button" onClick={handleSave} disabled={saving}
        className="h-9 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
