# Brisk CRM — Project Documentation

## Overview

**Brisk CRM** is an internal sales platform built with React + TypeScript + Supabase. It centralises prospect management, deal tracking, email communication, team workflows, and reporting for sales teams.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | ~6.0 |
| Build Tool | Vite | 8 |
| Routing | React Router | 7 (Data Router) |
| Styling | Tailwind CSS | 3.4 |
| UI Primitives | Radix UI + shadcn/ui | — |
| Charts | Recharts | 3 |
| Map | React Leaflet + Leaflet.js | — |
| Forms | React Hook Form + Zod | — |
| CSV Parsing | PapaParse | 5 |
| Rich Text | Tiptap | 3 |
| Drag & Drop | dnd-kit | — |
| Toasts | Sonner | 2 |
| Backend | Supabase (PostgreSQL + Auth + RLS + Storage + Edge Functions) | — |

---

## Project Structure

```
crm/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/              # Static images (logos, hero)
│   ├── components/
│   │   ├── auth/            # ProtectedRoute, PermissionGate, IPBlockedPage, ForcePasswordModal
│   │   ├── dashboard/       # MetricCard, RevenueChart, RetentionChart, LocationsCard, CalendarWidget, WidgetCustomizerPanel
│   │   ├── deals/           # PipelineBoard (Kanban), DealCard, DealDetailSheet, AddDealModal
│   │   ├── emails/          # EmailList, EmailEditor, ComposeModal, TemplatesPanel, CampaignStats
│   │   ├── layout/          # AppShell, Sidebar, Topbar, BottomNav, QuickActionFab, SessionExpiryModal
│   │   ├── notifications/   # NotificationPanel
│   │   ├── pipeline/        # PipelineUploadModal
│   │   ├── prospects/       # ProspectsTable, FilterPanel, ImportModal, ProspectDetailSheet
│   │   ├── reports/         # ConversionFunnel, RevenueOverTime, UserPerformance, ActivitySummary
│   │   ├── search/          # CommandPalette (⌘K)
│   │   ├── settings/        # ProfileTab, SecurityTab, ApiTab, SystemTab
│   │   ├── users/           # InviteUserModal, EditUserModal, PermissionsMatrix
│   │   ├── workflows/       # WorkflowBuilder, WorkflowCard, WorkflowLog
│   │   └── ui/              # Shared primitives
│   ├── constants/
│   │   ├── routes.ts        # All route paths
│   │   ├── roles.ts         # ROLES, PERMISSIONS, ROLE_PERMISSIONS matrix
│   │   ├── mockData.ts      # CRMUser type + dev mock data
│   │   ├── mockEmails.ts
│   │   ├── mockNotifications.ts
│   │   └── mockWorkflows.ts
│   ├── context/
│   │   ├── AuthContext.tsx  # Auth state, login/logout, session restoration
│   │   ├── ThemeContext.tsx # Light/dark theme
│   │   └── TopbarContext.tsx
│   ├── hooks/               # Data hooks (useProspects, useDeals, useUsers, useIPCheck, ...)
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client (reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
│   │   ├── auth.ts          # signIn, signOut, session helpers
│   │   └── utils.ts         # cn() and shared utilities
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── ProspectsPage.tsx
│   │   ├── DealsPage.tsx
│   │   ├── EmailsPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── WorkflowsPage.tsx
│   │   ├── PipelinePage.tsx
│   │   ├── UserManagementPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── NotesPage.tsx
│   │   ├── HelpPage.tsx
│   │   └── auth/            # LoginPage, AcceptInvitePage, ForbiddenPage, NotFoundPage
│   ├── services/            # All Supabase query logic, one file per domain
│   │   ├── analytics.service.ts
│   │   ├── apiKeys.service.ts
│   │   ├── deals.service.ts
│   │   ├── email.service.ts
│   │   ├── import.service.ts
│   │   ├── integrations.service.ts
│   │   ├── ip.service.ts
│   │   ├── notes.service.ts
│   │   ├── notifications.service.ts
│   │   ├── pipeline.service.ts
│   │   ├── pipelineSessions.service.ts
│   │   ├── projects.service.ts
│   │   ├── prospects.service.ts
│   │   ├── rateLimiter.service.ts
│   │   ├── settings.service.ts
│   │   ├── storage.service.ts
│   │   ├── users.service.ts
│   │   └── webhooks.service.ts
│   └── App.tsx              # Router, providers, IP gate
├── .env.local               # Local environment variables (never commit)
├── .env.example             # Template
├── index.html
├── package.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## Pages & Routes

| Route | Page | Permission Required |
|---|---|---|
| `/login` | LoginPage | Public |
| `/accept-invite` | AcceptInvitePage | Public |
| `/403` | ForbiddenPage | Public |
| `/dashboard` | DashboardPage | Authenticated |
| `/notes` | NotesPage | Authenticated |
| `/help` | HelpPage | Authenticated |
| `/settings` | SettingsPage | Authenticated |
| `/prospects` | ProspectsPage | `leads_view` |
| `/pipeline` | PipelinePage | `leads_import` |
| `/deals` | DealsPage | `deals_view` |
| `/emails` | EmailsPage | `emails_view` |
| `/reports` | ReportsPage | `reports_view` |
| `/workflows` | WorkflowsPage | `workflows_view` |
| `/users` | UserManagementPage | `users_view` |

---

## Authentication & Authorization

- **Provider:** Supabase Auth (email + password, JWT)
- **Session:** Stored in `localStorage`; "remember me = false" clears session on browser close
- **User profile:** Fetched from `crm_users` Supabase table on login, matched via `auth_id`
- **Invite flow:** Supabase sends invite email → user lands on `/accept-invite` with a token hash
- **Force password setup:** `user_metadata.needs_password_setup` flag triggers a modal on first login
- **IP Gate:** `useIPCheck` hook runs before the app shell; blocks access if the user's IP is restricted

### Roles & Permissions

| Permission | Super Admin | Data Analyst | Agent |
|---|:---:|:---:|:---:|
| View/Create/Edit prospects | ✅ | ✅ | ✅ |
| Delete prospects | ✅ | ✅ | — |
| Import / Export CSV | ✅ | ✅ | — |
| View/Manage deals | ✅ | ✅ | View only |
| View reports | ✅ | ✅ | — |
| View/send emails | ✅ | ✅ | ✅ |
| View/manage workflows | ✅ | View only | — |
| View users | ✅ | ✅ | — |
| Manage users | ✅ | — | — |
| IP & system settings | ✅ | — | — |
| API key management | ✅ | — | — |

---

## Key Features

### Prospects & Leads
- Server-side paginated table with sorting and multi-field filtering
- Filter by status, disposition code, email status, provider, country, industry
- Bulk select + bulk delete
- CSV import with chunked processing (50,000+ rows, live progress)
- CSV export and import template download

### Deals Pipeline
- Kanban board: Prospecting → Qualification → Proposal → Negotiation → Closed Won / Closed Lost
- Deal value, probability, assigned rep, close date
- Full edit via detail sheet

### Email
- Compose and send emails directly from the CRM
- Template library (General, Follow-up, Introduction, Proposal, Closing, Re-engagement, Newsletter)
- Rich text editor (Tiptap)

### Workflows & Automation
- Trigger rules: lead creation, deal stage change, activity due date
- Visual workflow builder with configurable actions

### Dashboard & Reports
- Live metric cards (total leads, conversion rate, avg CLV, revenue)
- Revenue trend chart, retention chart
- Interactive Leaflet world map with top customer locations
- Customisable widget panel (toggle any widget)
- Dashboard CSV export

### API, Webhooks & Integrations
- **API Keys:** Generated client-side (`sk_live_...`), hashed with SHA-256, stored in `api_keys` table. Plaintext shown only once.
- **Webhooks:** Register endpoints to receive real-time events (`prospect.created`, `deal.stage_changed`, etc.). HMAC signing secret shown once at creation.
- **Third-party integrations:** AirTable (sync prospects), MightCall (import call logs). Managed via Supabase Edge Functions (`airtable-sync`, `mightcall-sync`).

### App Shell
- Collapsible sidebar with Favorites + Projects (persisted per user in Supabase)
- Global command palette (⌘K / Ctrl+K)
- Real-time notification panel
- Quick Action FAB
- Session expiry warning modal
- Light / dark theme (default: light)

---

## Environment Variables

Only **two variables** are actually read by the application code:

| Variable | Where to get it | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key | ✅ |

> `VITE_API_KEY` and `VITE_WEBHOOK_URL` appear in `.env.local` but are **not currently read by any source file**. API keys and webhook secrets in this app are managed dynamically through the database, not static env vars. You can leave these blank or remove them.

---

## Database Tables (Supabase)

| Table | Purpose |
|---|---|
| `crm_users` | User profiles linked to Supabase Auth via `auth_id` |
| `prospects` | Lead / prospect records |
| `deals` | Deal pipeline entries |
| `api_keys` | User-generated API keys (hashed) |
| `webhook_endpoints` | Registered webhook URLs + event subscriptions |
| `integrations` | Third-party integration credentials (AirTable, MightCall) |
| `ip_rules` | IP whitelist / blacklist entries |
| `pipeline_sessions` | Bulk import session tracking |
| `notifications` | In-app notification records |
| `notes` | User notes |
| `projects` | Sidebar project entries per user |
| `favorites` | Sidebar favorites per user |

Row Level Security (RLS) is enforced on all tables via `003_rls_policies.sql`.

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env template and fill in Supabase credentials
cp .env.example .env.local

# Start dev server
npm run dev         # → http://localhost:5173

# Other scripts
npm run build       # Production build
npm run preview     # Preview production build
npm run lint        # ESLint
```

### Supabase Setup Checklist

1. Create a project at [app.supabase.com](https://app.supabase.com)
2. Run migrations in order via SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_auth_and_permissions.sql`
   - `supabase/migrations/003_rls_policies.sql`
3. **Authentication → Email** — disable "Confirm email"
4. **Authentication → URL Configuration** — set Site URL to `http://localhost:5173`
5. Create first user via **Authentication → Users → Add user**, then run:
   ```sql
   UPDATE public.crm_users SET role = 'Super Admin' WHERE email = 'your@email.com';
   ```

---

## Security Notes

- `.env.local` is gitignored — never commit it
- API key plaintext is never stored; only a SHA-256 hash is persisted
- Webhook secrets are shown once at creation; only a hashed version is stored
- IP-based access control can be managed from Settings → Security
- All Supabase queries are protected by RLS policies
