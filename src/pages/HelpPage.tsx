import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, Search, LayoutDashboard, Users, Briefcase,
  Mail, BarChart2, GitBranch, StickyNote, Shield, Settings,
  Keyboard, HelpCircle, MessageSquare, BookOpen, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { ROUTES } from '@/constants/routes'

// ── FAQ data ───────────────────────────────────────────────────
const FAQ_SECTIONS = [
  {
    section: 'Getting Started',
    icon: BookOpen,
    color: 'text-brand-500',
    bg: 'bg-brand-50 dark:bg-brand-900/20',
    items: [
      {
        q: 'What is Brisk CRM?',
        a: 'Brisk CRM is an internal customer relationship management tool for managing prospects, deals, email outreach, and team workflows — all in one place.',
      },
      {
        q: 'How do I log in?',
        a: 'Use the email and password set up by your Super Admin. If you were invited, check your email for an invitation link to set your password.',
      },
      {
        q: 'What are the different user roles?',
        a: 'There are three roles: Super Admin (full access including user management), Manager (access to reports and most features), and Agent (prospects, deals, and emails only). Your role is shown in the sidebar.',
      },
      {
        q: 'How do I change my profile picture or password?',
        a: 'Go to Settings → Profile tab. You can upload a profile photo, update your name and phone, and change your password from there.',
      },
    ],
  },
  {
    section: 'Prospects',
    icon: Users,
    color: 'text-sky-500',
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    items: [
      {
        q: 'How do I add a new prospect?',
        a: 'Click the "+ Add Prospect" button on the Prospects page. Fill in the required fields (first name, last name, email) and any optional details, then click Save.',
      },
      {
        q: 'How do I import prospects in bulk?',
        a: 'Use the Import button on the Prospects page. Download the CSV template, fill it in with your data, then upload it. The system processes up to 500 rows per file.',
      },
      {
        q: 'How do filters work?',
        a: 'Click the Filter button to open the filter panel. You can filter by status, disposition, country, industry, and more. Filters stack — all conditions must match for a row to show.',
      },
      {
        q: 'What do the status and disposition fields mean?',
        a: 'Status tracks where a prospect is in your pipeline (New, Contacted, Qualified, etc.). Disposition records the outcome of the last interaction (Interested, Not Interested, Callback, etc.).',
      },
    ],
  },
  {
    section: 'Deals',
    icon: Briefcase,
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    items: [
      {
        q: 'How do I create a deal?',
        a: 'Go to the Deals page and click "+ Add Deal". Enter the deal name, value, stage, and expected close date. You can link a deal to a prospect later via the deal detail view.',
      },
      {
        q: 'What is the Kanban view?',
        a: 'The Kanban board shows deals grouped by stage. Drag and drop cards between columns to update a deal\'s stage instantly.',
      },
      {
        q: 'How do I log an activity against a deal?',
        a: 'Open the deal detail view and use the Activities section to add calls, meetings, tasks, or notes. Each activity is timestamped and linked to that deal.',
      },
    ],
  },
  {
    section: 'Emails',
    icon: Mail,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    items: [
      {
        q: 'How do I send an email?',
        a: 'Click "Compose" on the Emails page. Type a recipient email, subject, and body. You can use the template picker to start from a preset, and toggle your email signature at the bottom.',
      },
      {
        q: 'Can I send to multiple recipients?',
        a: 'Yes. In the To/Cc/Bcc fields, type an email address and press Enter, Tab, or comma to add it as a chip. Add as many recipients as you need.',
      },
      {
        q: 'How do I create email templates?',
        a: 'Go to Emails → Templates tab → click "New Template". Give it a name, category, subject, and body. Use {{variable_name}} placeholders for dynamic content like {{first_name}}.',
      },
      {
        q: 'Why did my email fail to send?',
        a: 'Email sending uses the Resend service. If you see a 403 error, your Resend account is in test mode and can only send to your registered email address. A verified sending domain is required to reach other recipients.',
      },
    ],
  },
  {
    section: 'Import & Export',
    icon: Zap,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    items: [
      {
        q: 'What CSV format is required for import?',
        a: 'Download the template from the Prospects import dialog. Required columns are firstname, lastname, and email. All other columns (company, country, status, etc.) are optional.',
      },
      {
        q: 'Is there a row limit per import?',
        a: 'The bulk importer processes up to 500 rows per file. For larger datasets, split the file into multiple batches.',
      },
      {
        q: 'How do I export prospects?',
        a: 'On the Prospects page, click Export. The system downloads a CSV of all prospects that match your current filters.',
      },
    ],
  },
  {
    section: 'Permissions & Security',
    icon: Shield,
    color: 'text-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    items: [
      {
        q: 'Why can\'t I see a certain page?',
        a: 'Access to Reports, Workflows, and User Management requires specific permissions. Your role determines what you can see. Contact your Super Admin if you need access to a restricted area.',
      },
      {
        q: 'How does IP whitelisting work?',
        a: 'If your organisation has enabled IP restrictions, you must access the CRM from an approved IP address. Blocked users will see a dedicated error page with their IP address shown.',
      },
      {
        q: 'Is my data secure?',
        a: 'Yes. All data is stored in Supabase (PostgreSQL) with row-level security policies enforced on every table. Only authenticated users can access their own data.',
      },
    ],
  },
  {
    section: 'Account & Settings',
    icon: Settings,
    color: 'text-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    items: [
      {
        q: 'How do I invite a new team member?',
        a: 'Go to User Management (Super Admin only) and click "Invite User". Enter their email and role. They\'ll receive an email with a link to set their password.',
      },
      {
        q: 'How do I switch between light and dark mode?',
        a: 'Click the sun/moon icon in the top-right corner of the app to toggle between light and dark mode. Your preference is saved in the browser.',
      },
      {
        q: 'How do I deactivate a user?',
        a: 'In User Management, find the user and toggle their status to Inactive, or click the 3-dot menu and select Deactivate. Deactivated users cannot log in but their data is preserved.',
      },
    ],
  },
]

// ── Keyboard shortcuts ────────────────────────────────────────
const SHORTCUTS = [
  { keys: ['Ctrl', 'K'],    description: 'Open global search' },
  { keys: ['Esc'],          description: 'Close modal or panel' },
  { keys: ['Enter'],        description: 'Confirm action in focused modal' },
  { keys: ['Tab'],          description: 'Move focus to next field' },
  { keys: ['Shift', 'Tab'], description: 'Move focus to previous field' },
  { keys: ['?'],            description: 'Open this Help page' },
]

// ── Quick links ───────────────────────────────────────────────
const QUICK_LINKS = [
  { label: 'Dashboard',       icon: LayoutDashboard, route: ROUTES.DASHBOARD,  color: 'text-brand-500' },
  { label: 'Prospects',       icon: Users,           route: ROUTES.PROSPECTS,  color: 'text-sky-500' },
  { label: 'Deals',           icon: Briefcase,       route: ROUTES.DEALS,      color: 'text-violet-500' },
  { label: 'Emails',          icon: Mail,            route: ROUTES.EMAILS,     color: 'text-emerald-500' },
  { label: 'Notes',           icon: StickyNote,      route: ROUTES.NOTES,      color: 'text-amber-500' },
  { label: 'Reports',         icon: BarChart2,       route: ROUTES.REPORTS,    color: 'text-rose-500' },
  { label: 'Workflows',       icon: GitBranch,       route: ROUTES.WORKFLOWS,  color: 'text-cyan-500' },
  { label: 'Settings',        icon: Settings,        route: ROUTES.SETTINGS,   color: 'text-slate-500' },
]

// ── Accordion item ────────────────────────────────────────────
function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {q}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <p className="text-sm text-muted-foreground pb-4 leading-relaxed pr-8">
          {a}
        </p>
      )}
    </div>
  )
}

// ── Kbd badge ────────────────────────────────────────────────
function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded bg-muted border border-border text-[11px] font-mono font-semibold text-foreground">
      {children}
    </kbd>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export function HelpPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [openSection, setOpenSection] = useState<string | null>('Getting Started')

  const query = search.toLowerCase().trim()

  const filtered = query
    ? FAQ_SECTIONS.map(s => ({
        ...s,
        items: s.items.filter(
          i => i.q.toLowerCase().includes(query) || i.a.toLowerCase().includes(query),
        ),
      })).filter(s => s.items.length > 0)
    : FAQ_SECTIONS

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto flex flex-col gap-8">

        {/* Hero header */}
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 mb-4">
            <HelpCircle className="h-7 w-7 text-brand-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
          <p className="text-sm text-muted-foreground mt-2">Find answers, shortcuts, and quick links to every part of Brisk CRM.</p>

          {/* Search */}
          <div className="relative max-w-md mx-auto mt-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search FAQs…"
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors shadow-sm"
            />
          </div>
        </div>

        {/* Quick links */}
        {!query && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Navigation</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_LINKS.map(link => (
                <button
                  key={link.route}
                  type="button"
                  onClick={() => navigate(link.route)}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-border/80 transition-colors text-left group"
                >
                  <link.icon className={cn('h-4 w-4 shrink-0', link.color)} />
                  <span className="text-sm font-medium text-foreground">{link.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {query ? `Results for "${search}"` : 'Frequently Asked Questions'}
          </h2>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No results found</p>
              <p className="text-xs text-muted-foreground">Try different keywords or browse all sections below.</p>
              <button type="button" onClick={() => setSearch('')}
                className="mt-1 text-xs text-primary hover:underline">
                Clear search
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(section => {
                const isOpen = query ? true : openSection === section.section
                return (
                  <div key={section.section} className="bg-card border border-border rounded-xl overflow-hidden">
                    {/* Section header */}
                    <button
                      type="button"
                      onClick={() => setOpenSection(isOpen ? null : section.section)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', section.bg)}>
                          <section.icon className={cn('h-4 w-4', section.color)} />
                        </span>
                        <span className="text-sm font-semibold text-foreground">{section.section}</span>
                        <span className="text-xs text-muted-foreground">{section.items.length} articles</span>
                      </div>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} />
                    </button>

                    {/* FAQ items */}
                    {isOpen && (
                      <div className="px-5 border-t border-border">
                        {section.items.map((item, i) => (
                          <AccordionItem key={i} q={item.q} a={item.a} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Keyboard shortcuts */}
        {!query && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" /> Keyboard Shortcuts
            </h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className={cn('flex items-center justify-between px-5 py-3', i < SHORTCUTS.length - 1 && 'border-b border-border')}>
                  <span className="text-sm text-muted-foreground">{s.description}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, ki) => (
                      <span key={ki} className="flex items-center gap-1">
                        <Kbd>{k}</Kbd>
                        {ki < s.keys.length - 1 && <span className="text-[10px] text-muted-foreground">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact / support */}
        {!query && (
          <div className="bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-900/10 border border-brand-200 dark:border-brand-800/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white dark:bg-brand-900/40 border border-brand-200 dark:border-brand-700/40 flex items-center justify-center shrink-0 shadow-sm">
              <MessageSquare className="h-6 w-6 text-brand-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Still need help?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Contact your Super Admin or reach out to the development team at{' '}
                <a href="mailto:jonathan.mauring17@gmail.com" className="text-primary hover:underline font-medium">
                  jonathan.mauring17@gmail.com
                </a>
              </p>
            </div>
            <a
              href="mailto:jonathan.mauring17@gmail.com"
              className="shrink-0 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" /> Contact Support
            </a>
          </div>
        )}

      </div>
    </PageWrapper>
  )
}
