import { useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const inputCls = cn(
  'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-muted-foreground',
)

const selectCls = cn(
  'w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors hover:border-muted-foreground',
)

interface SettingRow {
  key: string
  label: string
  description: string
  type: 'number' | 'select' | 'text'
  value: string
  options?: string[]
}

function useSection(initial: SettingRow[]) {
  const [rows, setRows] = useState(initial)
  const [dirty, setDirty] = useState(false)

  function update(key: string, value: string) {
    setRows(p => p.map(r => r.key === key ? { ...r, value } : r))
    setDirty(true)
  }

  function save(sectionName: string) {
    toast.success(`${sectionName} settings saved`)
    setDirty(false)
  }

  return { rows, dirty, update, save }
}

interface SectionProps {
  title: string
  description?: string
  section: ReturnType<typeof useSection>
}

function Section({ title, description, section }: SectionProps) {
  const { rows, dirty, update, save } = section
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <button type="button" onClick={() => save(title)} disabled={!dirty}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0">
          <Save className="h-3 w-3" /> Save
        </button>
      </div>
      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.key} className="grid grid-cols-2 gap-4 items-start">
            <div>
              <p className="text-sm text-foreground font-medium">{row.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{row.description}</p>
            </div>
            <div>
              {row.type === 'select' ? (
                <select value={row.value} onChange={e => update(row.key, e.target.value)} className={selectCls}>
                  {row.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={row.type === 'number' ? 'number' : 'text'}
                  value={row.value}
                  onChange={e => update(row.key, e.target.value)}
                  className={inputCls}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SystemTab() {
  const sessionSection = useSection([
    { key: 'session_timeout',  label: 'Session Timeout',  description: 'Minutes of inactivity before auto-logout', type: 'number', value: '30' },
    { key: 'max_sessions',     label: 'Max Concurrent Sessions', description: 'Per user, additional sessions are rejected', type: 'number', value: '3' },
    { key: 'remember_me_days', label: 'Remember Me Duration', description: 'Days before re-authentication is required', type: 'number', value: '14' },
  ])

  const uploadSection = useSection([
    { key: 'max_upload_mb',    label: 'Max Upload Size (MB)',   description: 'Maximum file size for uploads',      type: 'number', value: '10' },
    { key: 'allowed_types',    label: 'Allowed File Types',     description: 'Comma-separated extensions',         type: 'text',   value: 'pdf,jpg,jpeg,png,csv,xlsx' },
    { key: 'storage_quota_gb', label: 'Storage Quota per User (GB)', description: 'Total storage allowance per user', type: 'number', value: '5' },
  ])

  const defaultsSection = useSection([
    {
      key: 'default_role',
      label: 'Default Role for New Invites',
      description: 'Role assigned when no role is specified',
      type: 'select',
      value: 'Agent',
      options: ['Agent', 'Data Analyst', 'Super Admin'],
    },
    {
      key: 'default_timezone',
      label: 'Default Timezone',
      description: 'Used for date/time display across the CRM',
      type: 'select',
      value: 'Australia/Sydney',
      options: ['Australia/Sydney', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'],
    },
    {
      key: 'date_format',
      label: 'Date Format',
      description: 'How dates are displayed in the app',
      type: 'select',
      value: 'MMM d, yyyy',
      options: ['MMM d, yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'],
    },
  ])

  const dataSection = useSection([
    { key: 'data_retention_days', label: 'Data Retention (days)', description: 'Days to retain deleted record backups', type: 'number', value: '90' },
    {
      key: 'audit_log_level',
      label: 'Audit Log Level',
      description: 'Granularity of the audit trail',
      type: 'select',
      value: 'Standard',
      options: ['Minimal', 'Standard', 'Verbose'],
    },
    { key: 'export_limit',     label: 'CSV Export Row Limit',     description: 'Maximum rows per export',           type: 'number', value: '10000' },
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <Section title="Session & Authentication" section={sessionSection} />
      <Section title="File Uploads & Storage" section={uploadSection} />
      <Section
        title="Application Defaults"
        description="Default values applied to new users and records"
        section={defaultsSection}
      />
      <Section
        title="Data & Audit"
        description="Control how long data is retained and logged"
        section={dataSection}
      />
    </div>
  )
}
