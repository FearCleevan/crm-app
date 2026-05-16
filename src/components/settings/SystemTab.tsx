import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSystemSettings } from '@/hooks/useSystemSettings'

const inputCls = cn(
  'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-muted-foreground',
)

const selectCls = cn(
  'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-muted-foreground',
)

interface SettingDef {
  key: string
  label: string
  description: string
  type: 'number' | 'select' | 'text'
  defaultValue: string
  options?: string[]
}

const SECTIONS: { id: string; title: string; description?: string; defs: SettingDef[] }[] = [
  {
    id: 'session',
    title: 'Session & Authentication',
    defs: [
      { key: 'session_timeout',  label: 'Session Timeout',           description: 'Minutes of inactivity before auto-logout',   type: 'number', defaultValue: '30'  },
      { key: 'max_sessions',     label: 'Max Concurrent Sessions',   description: 'Per user, additional sessions are rejected',  type: 'number', defaultValue: '3'   },
      { key: 'remember_me_days', label: 'Remember Me Duration',      description: 'Days before re-authentication is required',   type: 'number', defaultValue: '14'  },
    ],
  },
  {
    id: 'upload',
    title: 'File Uploads & Storage',
    defs: [
      { key: 'max_upload_mb',    label: 'Max Upload Size (MB)',         description: 'Maximum file size for uploads',      type: 'number', defaultValue: '10'                        },
      { key: 'allowed_types',    label: 'Allowed File Types',           description: 'Comma-separated extensions',         type: 'text',   defaultValue: 'pdf,jpg,jpeg,png,csv,xlsx' },
      { key: 'storage_quota_gb', label: 'Storage Quota per User (GB)', description: 'Total storage allowance per user',   type: 'number', defaultValue: '5'                         },
    ],
  },
  {
    id: 'defaults',
    title: 'Application Defaults',
    description: 'Default values applied to new users and records',
    defs: [
      { key: 'default_role',     label: 'Default Role for New Invites', description: 'Role assigned when no role is specified',   type: 'select', defaultValue: 'Agent',            options: ['Agent', 'Data Analyst', 'Super Admin'] },
      { key: 'default_timezone', label: 'Default Timezone',             description: 'Used for date/time display across the CRM', type: 'select', defaultValue: 'Australia/Sydney', options: ['Australia/Sydney', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'] },
      { key: 'date_format',      label: 'Date Format',                  description: 'How dates are displayed in the app',        type: 'select', defaultValue: 'MMM d, yyyy',     options: ['MMM d, yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] },
    ],
  },
  {
    id: 'data',
    title: 'Data & Audit',
    description: 'Control how long data is retained and logged',
    defs: [
      { key: 'data_retention_days', label: 'Data Retention (days)', description: 'Days to retain deleted record backups', type: 'number', defaultValue: '90'        },
      { key: 'audit_log_level',     label: 'Audit Log Level',       description: 'Granularity of the audit trail',        type: 'select', defaultValue: 'Standard', options: ['Minimal', 'Standard', 'Verbose'] },
      { key: 'export_limit',        label: 'CSV Export Row Limit',  description: 'Maximum rows per export',               type: 'number', defaultValue: '10000'     },
    ],
  },
]

export function SystemTab() {
  const { getValue, upsert, loading } = useSystemSettings()

  const [values,   setValues]   = useState<Record<string, string>>({})
  const [dirty,    setDirty]    = useState<Record<string, boolean>>({})
  const [saving,   setSaving]   = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  // Hydrate once: after settings finish loading from DB
  useEffect(() => {
    if (loading || hydrated) return
    const initial: Record<string, string> = {}
    for (const sec of SECTIONS) {
      for (const def of sec.defs) {
        initial[def.key] = getValue(def.key) ?? def.defaultValue
      }
    }
    setValues(initial)
    setHydrated(true)
  }, [loading, hydrated, getValue])

  function update(key: string, value: string, sectionId: string) {
    setValues(prev => ({ ...prev, [key]: value }))
    setDirty(prev => ({ ...prev, [sectionId]: true }))
  }

  async function saveSection(section: typeof SECTIONS[number]) {
    setSaving(prev => ({ ...prev, [section.id]: true }))
    try {
      await Promise.all(
        section.defs.map(def => upsert(def.key, values[def.key] ?? def.defaultValue))
      )
      toast.success(`${section.title} saved`)
      setDirty(prev => ({ ...prev, [section.id]: false }))
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(prev => ({ ...prev, [section.id]: false }))
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {SECTIONS.map(section => (
        <div key={section.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              {section.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => saveSection(section)}
              disabled={!dirty[section.id] || !!saving[section.id]}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              {saving[section.id]
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Save className="h-3 w-3" />}
              Save
            </button>
          </div>

          <div className="space-y-3">
            {section.defs.map(def => (
              <div key={def.key} className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <p className="text-sm text-foreground font-medium">{def.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{def.description}</p>
                </div>
                <div>
                  {def.type === 'select' ? (
                    <select
                      aria-label={def.label}
                      value={values[def.key] ?? def.defaultValue}
                      onChange={e => update(def.key, e.target.value, section.id)}
                      className={selectCls}
                    >
                      {def.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      aria-label={def.label}
                      type={def.type === 'number' ? 'number' : 'text'}
                      value={values[def.key] ?? def.defaultValue}
                      onChange={e => update(def.key, e.target.value, section.id)}
                      className={inputCls}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
