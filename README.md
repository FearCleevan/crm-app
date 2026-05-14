# Brisk CRM

A modern, full-featured internal CRM platform built to manage leads, automate follow-ups, and close deals faster.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?style=flat&logo=tailwindcss)

---

## Overview

Brisk CRM is an internal sales platform that centralises prospect management, deal tracking, email communication, and team workflows in one place. Designed for sales teams who need fast, reliable tooling without the overhead of a generic CRM.

---

## Features

### Prospects & Leads
- Full prospects table with server-side pagination, sorting, and filtering
- Advanced filter panel — by status, disposition code, email status, provider, country, industry
- Add, edit, and delete individual prospects
- Bulk select and bulk delete
- CSV import (chunked, supports 50 000+ rows with live progress bar)
- CSV export (filtered or full) and downloadable import template

### Deals Pipeline
- Kanban-style deal stages: Prospecting → Qualification → Proposal → Negotiation → Closed Won / Lost
- Deal value, probability, assigned rep, and close date tracking
- Deal detail sheet with full edit support

### Email & Templates
- Compose and send emails directly from the CRM
- Email template library with categories (General, Follow-up, Introduction, Proposal, Closing, Re-engagement, Newsletter)
- Create, edit, and delete templates with a modal form

### Workflows & Automation
- Automation rules triggered by lead creation, deal stage changes, or activity due dates
- Visual workflow builder with action configuration

### Dashboard & Reports
- Live metric cards: total leads, conversion rate, avg CLV, revenue
- Interactive revenue trend chart (Recharts)
- Leads by source and disposition breakdown
- Interactive world map (Leaflet) showing top customer locations with tooltips
- Customisable widget panel — toggle any widget on or off
- Dashboard CSV export
- Light / dark mode adaptive map tiles (CartoDB Positron / Dark Matter)

### User Management
- Role-based access: **Super Admin**, **Data Analyst**, **Agent**
- Granular permission matrix per role
- Invite users, update roles, activate / deactivate accounts
- Permission gates on every page and action

### Settings & Security
- Profile settings (name, avatar, contact info)
- IP whitelist / blacklist management
- System settings panel
- API key management (generate, revoke)

### App Shell
- Collapsible sidebar with Favorites and Projects (add, rename, delete, persisted per user)
- Global command palette (⌘K / Ctrl+K) for instant navigation
- Real-time notification panel with mark-read and clear-all
- Quick Action FAB for common tasks
- Session expiry warning modal
- Light and dark theme (default: light)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 6 |
| Routing | React Router v6 (Data Router) |
| Styling | Tailwind CSS v3 + CSS custom properties |
| UI Components | Radix UI primitives + shadcn/ui |
| Charts | Recharts |
| Map | React Leaflet + Leaflet.js |
| Forms | React Hook Form + Zod |
| CSV | PapaParse |
| Toasts | Sonner |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions + Storage) |
| Auth | Supabase Auth — JWT, email/password |

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- A **Supabase** project — [create one free at app.supabase.com](https://app.supabase.com)

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/crm-project.git
cd crm-project/crm-app

# 2. Install dependencies
npm install
```

---

## Environment Setup

Create a `.env` file in the `crm-app/` directory (copy from `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are in your Supabase dashboard under **Project Settings → API**.

> `.env` is in `.gitignore` — never commit it.

---

## Database Setup

Run each migration in order inside **Supabase SQL Editor → New query → Run**:

| File | What it does |
|---|---|
| `supabase/migrations/001_initial_schema.sql` | Core tables, triggers, indexes |
| `supabase/migrations/002_auth_and_permissions.sql` | Permissions system, prospects table, `handle_new_user` trigger |
| `supabase/migrations/003_rls_policies.sql` | Row Level Security policies on all tables |

### Supabase Auth Settings

In **Authentication → Sign In / Providers → Email** — disable **Confirm email**.

In **Authentication → URL Configuration** — set Site URL to `http://localhost:5173`.

### Create Your First User

1. Go to **Authentication → Users → Add user** and create an account.
2. Run this SQL to give it Super Admin access:

```sql
UPDATE public.crm_users
SET role = 'Super Admin'
WHERE email = 'your-email@here.com';
```

---

## Running Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Available Scripts

```bash
npm run dev       # Start development server (hot reload)
npm run build     # Production build
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

---

## Project Structure

```
crm-app/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── auth/           # ProtectedRoute
│   │   ├── dashboard/      # Metric cards, charts, LocationsCard, WidgetCustomiser
│   │   ├── deals/          # Kanban board, deal modals
│   │   ├── emails/         # Compose panel, template modal
│   │   ├── layout/         # AppShell, Sidebar, Topbar, FAB, SessionModal
│   │   ├── notifications/  # Notification panel
│   │   ├── prospects/      # Table, filter panel, import modal, detail sheet
│   │   ├── search/         # Command palette
│   │   └── ui/             # Shared primitives (buttons, modals, badges…)
│   ├── constants/          # Routes, roles, permissions, mock data
│   ├── context/            # AuthContext, ThemeContext, TopbarContext
│   ├── hooks/              # Data hooks (useProspects, useUsers, useIPManagement…)
│   ├── lib/                # supabase.ts, auth.ts, utils.ts
│   ├── pages/              # One file per route
│   ├── services/           # Supabase query functions
│   ├── styles/             # globals.css (CSS custom properties, Leaflet overrides)
│   └── types/              # database.ts — DB row types
├── .env.example
├── index.html
├── package.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## Role Permissions

| Feature | Super Admin | Data Analyst | Agent |
|---|:---:|:---:|:---:|
| View prospects | ✅ | ✅ | ✅ |
| Create / edit prospects | ✅ | ✅ | ✅ |
| Delete prospects | ✅ | ✅ | — |
| Import CSV | ✅ | ✅ | — |
| Export CSV | ✅ | ✅ | — |
| View deals | ✅ | ✅ | ✅ |
| Manage deals | ✅ | ✅ | — |
| View reports | ✅ | ✅ | — |
| View / manage workflows | ✅ | ✅ / — | — |
| View users | ✅ | ✅ | — |
| Manage users | ✅ | — | — |
| IP & system settings | ✅ | — | — |

---

## License

Internal use only. Not licensed for public distribution.
