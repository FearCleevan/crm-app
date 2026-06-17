import { useState } from 'react'
import { User, Shield, Settings, Puzzle, Mail } from 'lucide-react'
import { TopbarSlot } from '@/context/TopbarContext'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useAuth } from '@/context/AuthContext'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { SecurityTab } from '@/components/settings/SecurityTab'
import { SystemTab } from '@/components/settings/SystemTab'
import { ApiTab } from '@/components/settings/ApiTab'
import { EmailOutreachTab } from '@/components/settings/EmailOutreachTab'
import { cn } from '@/lib/utils'

type Tab = 'profile' | 'security' | 'system' | 'api' | 'outreach'

const TABS: { id: Tab; label: string; icon: typeof User; adminOnly?: boolean }[] = [
  { id: 'profile',  label: 'Profile',         icon: User    },
  { id: 'security', label: 'Security',         icon: Shield,  adminOnly: true },
  { id: 'system',   label: 'System',           icon: Settings, adminOnly: true },
  { id: 'api',      label: 'API Integration',  icon: Puzzle  },
  { id: 'outreach', label: 'Email Outreach',   icon: Mail,    adminOnly: true },
]

export function SettingsPage() {
  const { hasPermission } = useAuth()
  const isSuperAdmin = hasPermission('settings_manage')
  const [tab, setTab] = useState<Tab>('profile')

  const visibleTabs = TABS.filter(t => !t.adminOnly || isSuperAdmin)

  return (
    <>
      <TopbarSlot>
        <span className="hidden md:block text-xs text-muted-foreground">
          {isSuperAdmin ? 'Super Admin' : 'User'} Settings
        </span>
      </TopbarSlot>

      <PageWrapper noPad className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your account, security, and integrations</p>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar nav (tablet+) */}
          <nav className="hidden md:flex flex-col w-48 shrink-0 border-r border-border bg-card py-3 px-2 gap-0.5">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors text-left w-full',
                  tab === id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Horizontal tabs (mobile) */}
          <div className="md:hidden shrink-0">
            <div className="flex overflow-x-auto gap-0.5 px-4 py-2 border-b border-border bg-card no-scrollbar">
              {visibleTabs.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={cn(
                    'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                    tab === id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent',
                  )}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {tab === 'profile'  && <ProfileTab />}
            {tab === 'security' && <SecurityTab />}
            {tab === 'system'   && <SystemTab />}
            {tab === 'api'      && <ApiTab />}
            {tab === 'outreach' && <EmailOutreachTab />}
          </main>
        </div>
      </PageWrapper>
    </>
  )
}
