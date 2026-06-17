# BRISK CRM — Master Upgrade Implementation
## FRONTEND_IMPLEMENTATION.md (Consolidated — All Features + Audited Enhancements)

---

## Overview

This is the **complete consolidated frontend implementation** for all Brisk CRM upgrades,
based on the existing codebase at `github.com/FearCleevan/crm-app`.

### Purpose
Peter Paul Lazan (FearCleevan) will use Brisk CRM as his **personal freelance outreach tool**
to pitch web development services to 51,863 prospects already loaded in the database.

### Existing Stack
- React 18 + TypeScript + Vite
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS + shadcn/ui + Radix UI
- React Router v6 (Data Router)
- Recharts (charts), React Leaflet (map)
- PapaParse (CSV), React Hook Form + Zod
- Sonner (toasts)

### All Features Being Added
1. Custom Column Export Selector (Prospects upgrade)
2. Campaign List Page
3. Template Manager Upgrade (variable system)
4. Create Campaign Wizard
5. Prospect Selector for Campaigns
6. Campaign Detail & Stats
7. Email Compose Upgrade (template picker + variables)
8. Sending Schedule Settings UI
9. Pipeline Auto-Update UI indicators

> ⚠️ ALL phases use mock/sample data only.
> Backend wiring happens in BACKEND_IMPLEMENTATION.md after ALL frontend is complete.
> Stop and report after each phase. Do not proceed without explicit "Yes, Proceed."

---

## Pre-Phase Setup — Common Utilities

### Create Before Starting Phase 1

**File: `src/lib/campaign-utils.ts`**

Create this shared utility file ONCE before any phase begins.
All phases import from here — do not duplicate these functions inline.

```typescript
// src/lib/campaign-utils.ts

export const formatDate = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }).format(new Date(date))
}

export const formatTime = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(date))
}

export const truncateText = (text: string, maxLen: number = 50): string => {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

export const getStatusBadgeClass = (status: string): string => {
  const map: Record<string, string> = {
    draft:         'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    active:        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    paused:        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    completed:     'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    pending:       'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    sent:          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    opened:        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    clicked:       'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
    replied:       'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    bounced:       'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    unsubscribed:  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  }
  return map[status.toLowerCase()] ?? 'bg-gray-100 text-gray-800'
}
```

---

## Global UI Standards (Apply to All Phases)

### Design System
- All new components use existing shadcn/ui primitives
- Match CSS custom properties from `src/styles/globals.css`
- Full light/dark mode support on every new component
- Use `Sonner` toast for all success/error/info notifications
- Use `React Hook Form + Zod` for all new forms
- Use `Recharts` for all new charts (already installed)
- Import status colors from `campaign-utils.ts` — never hardcode inline

### Accessibility (A11y) — Apply to Every Phase
- All buttons, inputs, modals, dropdowns must have `aria-label` attributes
- Modals must **trap focus** when opened
- Modals must close on **ESC key** press
- Ensure sufficient color contrast on all status badges
- Template Variable Chips (Phase 3): support **arrow keys + Enter** to insert

### Role-Based Access
Roles come from `crm_users.role` CHECK constraint:
`'Super Admin' | 'Data Analyst' | 'Agent'`

Brisk also has a full `role_permissions` + `permission_modules` system.
Use the existing permission context/hook when checking access — do not hardcode role strings.

| Feature | Super Admin | Data Analyst | Agent |
|---------|-------------|--------------|-------|
| Export Column Selector | ✅ | ✅ | ✅ |
| View Campaigns | ✅ | ✅ | — |
| Create/Edit Campaign | ✅ | ✅ | — |
| Pause/Resume Campaign | ✅ | ✅ | — |
| Delete Campaign | ✅ | — | — |
| Manage Templates | ✅ | ✅ | — |
| View Campaign Stats | ✅ | ✅ | — |
| Outreach Settings | ✅ | — | — |
| Pipeline Campaign Badge | ✅ | ✅ | ✅ |

> **Implementation Note:** Conditionally render action buttons based on role.
> Example: The `Delete` button on campaigns is hidden for Data Analyst and Agent.
> The `Edit`, `Pause`, `Resume` buttons are hidden for Agent only.

### Frontend Simulation Rules (Pre-Backend)
Since backend is deferred, simulate all dynamic behavior with mock data:

| Feature | Frontend Behavior |
|---------|------------------|
| Phase 9 Pipeline Stages | Static mock timestamps — no real mutations |
| Phase 7 Schedule Send | Show clock icon only — no actual sending |
| Phase 8 Warmup Chart | Static calculation from user input — no API call |
| Phase 6 Activity Chart | Use `mockActivityData` constant defined below |

### Prospect Table Field Reference
All data from `public.prospects` table:
```
fullname, firstname, lastname, jobtitle, company,
website, personallinkedin, companylinkedin,
altphonenumber, companyphonenumber, email, emailcode,
address, street, city, state, postalcode, country,
annualrevenue, industry, employeesize, department,
seniority, dispositioncode, providercode, status
```
> ⚠️ `prospects.id` is `bigint` — always type as `number` in TypeScript.
> All selection arrays, Sets, and FK references must use `number` not `string`.

### Lookup Tables (for filter dropdowns)
```
prospects_country       → country_code, country_name
prospects_industry      → industry_code, industry_name
prospects_email_status  → email_code, email_name
prospects_disposition   → disposition_code, disposition_name
prospects_provider      → provider_code, provider_name
```

---

## Phases Overview

| Phase | Feature | Complexity |
|-------|---------|-----------|
| 1 | Custom Export Column Selector | Low |
| 2 | Campaign List Page | Medium |
| 3 | Template Manager Upgrade | Medium |
| 4 | Create Campaign Wizard | High |
| 5 | Prospect Selector | Medium |
| 6 | Campaign Detail & Stats | High |
| 7 | Email Compose Upgrade | Medium |
| 8 | Sending Schedule UI | Low |
| 9 | Pipeline Auto-Update UI | Medium |

---

## Phase 1 — Custom Export Column Selector

### Goal
Upgrade the existing **Export CSV** button in the Prospects page.
Opens a Column Selector Modal — user picks columns → downloads CSV.

### Trigger
`Export` button clicked → Modal opens → Columns selected
→ `Export CSV` clicked → File downloads → Modal closes.

### Modal Layout

#### Header
- Title: "Export CSV — Select Columns"
- Subtitle: "Choose the columns to include in your export"

#### Section 1 — Quick Presets
| Preset | Columns Selected |
|--------|-----------------|
| All Columns | Everything |
| Contact Info | Full Name, Email, Phone, Company |
| Outreach | First Name, Last Name, Email, Company, Job Title, Website |
| Location | Full Name, Email, City, State, Country |

- Clicking preset updates checkboxes instantly
- Active preset highlighted with primary color
- Clicking active preset **toggles it off** and returns to previous manual state

#### Section 2 — Column Checkbox Grid (2 columns)

LEFT:
```
[ ] Full Name        (fullname)
[ ] First Name       (firstname)
[ ] Last Name        (lastname)
[ ] Job Title        (jobtitle)
[ ] Company          (company)
[ ] Website          (website)
[ ] Email            (email)
[ ] Phone            (altphonenumber)
[ ] Company Phone    (companyphonenumber)
[ ] LinkedIn         (personallinkedin)
[ ] Company LinkedIn (companylinkedin)
```

RIGHT:
```
[ ] Address          (address)
[ ] Street           (street)
[ ] City             (city)
[ ] State            (state)
[ ] Postal Code      (postalcode)
[ ] Country          (country)
[ ] Industry         (industry)
[ ] Annual Revenue   (annualrevenue)
[ ] Employee Size    (employeesize)
[ ] Department       (department)
[ ] Seniority        (seniority)
```

#### Section 3 — Select Controls
- "Select All" / "Deselect All" links (left-aligned, below grid)

#### Section 4 — Footer (sticky)
- Left: "X of 22 columns selected" (live counter)
- Right: `Cancel` | `Export CSV` (disabled if 0 selected)

### Default Selected Columns
```
✅ First Name, Last Name, Email, Company, Job Title, Website, Country
```

### Export Logic
```typescript
type ExportColumn = {
  key: keyof Prospect
  label: string
  defaultSelected: boolean
}

// 1. Get currently filtered prospects (same as existing export)
// 2. Map only selected column keys per prospect
// 3. Header row uses label (not key) e.g. "First Name" not "firstname"
// 4. PapaParse unparse() → CSV string
// 5. Blob download → "prospects-export-YYYY-MM-DD.csv"
// 6. Close modal
```

### Validation & Edge Cases
- **Cancel / ESC**: Closes modal, discards selection, no confirmation needed
- **Zero columns**: Export button disabled, counter shows "0 of 22 columns selected"
- **Preset toggle**: Clicking active preset deactivates it, restores prior checkbox state

### Files to Create/Modify
```
CREATE: src/components/prospects/ExportColumnModal.tsx
MODIFY: ProspectsPage or ProspectsTable — replace direct export with modal trigger
```

### Do NOT Change
- Existing filter/query logic
- Supabase queries
- PapaParse (already installed)

---

## Phase 2 — Campaign List Page

### Goal
New page at `/emails/campaigns`.

### Sidebar Update
```
Emails
  ├── Inbox       (existing)
  ├── Sent        (existing)
  ├── Drafts      (existing)
  ├── Templates   (existing → upgraded Phase 3)
  └── Campaigns   (NEW)
```

### Page Layout

#### Header
- Title: "Campaigns"
- Subtitle: "Manage your cold outreach sequences"
- CTA: `+ New Campaign` (opens wizard — Phase 4)

#### Stats Bar — 4 Cards
| Metric | Mock Value | Icon |
|--------|------------|------|
| Total Campaigns | 3 | 📋 |
| Total Emails Sent | 247 | 📤 |
| Avg Open Rate | 28.4% | 👁️ |
| Avg Reply Rate | 6.2% | 💬 |

#### Campaign Table
| Column | Description |
|--------|-------------|
| Name | Clickable → Campaign Detail |
| Status | Badge (use `getStatusBadgeClass`) |
| Recipients | Total |
| Sent | Count |
| Opened | Count + % |
| Replied | Count + % |
| Created | `formatDate()` |
| Actions | ••• menu |

#### Actions Menu — Permission-Gated
| Action | Super Admin | Data Analyst | Agent |
|--------|-------------|--------------|-------|
| Edit | ✅ | ✅ | hidden |
| Pause / Resume | ✅ | ✅ | hidden |
| Delete | ✅ | hidden | hidden |

#### Status Badge Colors
Use `getStatusBadgeClass()` from `campaign-utils.ts`

#### Empty State
- Icon: 📧
- Title: "No campaigns yet"
- Subtitle: "Create your first outreach campaign to start reaching prospects"
- CTA: `+ Create Campaign`

### Mock Data
```typescript
const mockCampaigns = [
  {
    id: '1',
    name: 'US Small Business Outreach',
    status: 'active',
    total_recipients: 150,
    total_sent: 98,
    total_opened: 27,
    total_replied: 6,
    created_at: '2026-06-10',
  },
  {
    id: '2',
    name: 'Canada E-commerce Landing Pages',
    status: 'draft',
    total_recipients: 45,
    total_sent: 0,
    total_opened: 0,
    total_replied: 0,
    created_at: '2026-06-14',
  },
  {
    id: '3',
    name: 'Australia Service Businesses',
    status: 'paused',
    total_recipients: 80,
    total_sent: 80,
    total_opened: 22,
    total_replied: 4,
    created_at: '2026-06-01',
  },
]
```

### Files to Create/Modify
```
CREATE: src/pages/CampaignsPage.tsx
CREATE: src/components/emails/CampaignTable.tsx
CREATE: src/components/emails/CampaignStatBar.tsx
MODIFY: src/constants/routes.ts — add /emails/campaigns
MODIFY: src/components/layout/Sidebar.tsx — add Campaigns nav item
```

---

## Phase 3 — Template Manager Upgrade

### Goal
Replace the existing basic template list with a full Template Manager.

### Categories
```
existing DB values: general, follow_up, introduction, proposal,
                    closing, re_engagement, newsletter
new values:         cold_outreach, no_website, outdated_website
```

### Page Layout
- Toggle: Grid View | List View (default: Grid)
- Filter: Category dropdown | Search by name
- `+ New Template` button

### Template Card
- Name (bold), Category badge, Subject preview (1 line), Body preview (2 lines, gray)
- Last modified (`formatDate()`), Actions: Edit | Duplicate | Delete

### Create/Edit Modal

#### Fields
| Field | Type | Validation |
|-------|------|-----------|
| Template Name | Text | Required, 3–100 chars |
| Category | Select | All categories |
| Subject | Text | Required, max 255 chars |
| Body | Textarea | Required |

#### Variable Chips
```
[+ First Name]  [+ Last Name]  [+ Company]  [+ Job Title]
[+ Website]     [+ My Name]    [+ My Portfolio]
```

- Clicking chip inserts variable at cursor position
- Keyboard: arrow keys to navigate chips, Enter to insert

#### Variable Map
| Variable | Prospect Field | Fallback |
|----------|---------------|---------|
| `{{first_name}}` | `firstname` | `''` |
| `{{last_name}}` | `lastname` | `''` |
| `{{full_name}}` | `fullname` | `''` |
| `{{company}}` | `company` | `'your company'` |
| `{{job_title}}` | `jobtitle` | `''` |
| `{{website}}` | `website` | `''` |
| `{{my_name}}` | static | `'Peter Lazan'` |
| `{{my_portfolio}}` | static | `'lazandev.vercel.app'` |

> ⚠️ `{{my_name}}` and `{{my_portfolio}}` are **hardcoded constants** for now.
> In the backend phase, `{{my_name}}` will resolve from `crm_users.first_name + last_name`.
> `{{my_portfolio}}` has **no column in the current schema** — it stays hardcoded
> until a `portfolio_url` column is added to `crm_users` in a future migration.

#### Modal Tabs
- **Edit** — write/edit content
- **Preview** — renders with sample data:
  ```
  first_name: "John", company: "Acme Corp",
  job_title: "CEO", website: "acmecorp.com"
  ```
  Unresolved variables highlighted in **orange**

#### Footer
- Left: character count
- Right: `Cancel` | `Save Template`

### Validation & Edge Cases
- **Duplicate name**: Check frontend mock array for matching name.
  If found → Sonner toast: `"A template with this name already exists."`
  > Note: `email_templates` has NO unique DB constraint on `name` — frontend check only.
- **Cancel with unsaved changes**: Show confirmation dialog:
  `"You have unsaved changes. Are you sure you want to discard them?"`
- **ESC key**: Triggers same unsaved changes check if form is dirty

### Mock Templates
```typescript
const mockTemplates = [
  {
    id: '1',
    name: 'No Website — Cold Outreach',
    category: 'cold_outreach',
    subject: 'Quick question about {{company}}',
    body: `Hi {{first_name}},\n\nI was looking up {{company}} and couldn't find a website — are you currently looking to get one built?\n\nI specialize in fast, modern websites for businesses like yours.\n\nPortfolio: {{my_portfolio}}\n\nWorth a quick chat?\n\n— {{my_name}}`,
    variables: ['first_name', 'company', 'my_portfolio', 'my_name'],
  },
  {
    id: '2',
    name: 'Outdated Website — Refresh Pitch',
    category: 'outdated_website',
    subject: "{{company}}'s website",
    body: `Hi {{first_name}},\n\nI came across {{company}} and noticed your site could use a modern refresh — especially on mobile.\n\nI build clean, fast websites starting at $300 USD.\n\nPortfolio: {{my_portfolio}}\n\nOpen to a quick email exchange?\n\n— {{my_name}}`,
    variables: ['first_name', 'company', 'my_portfolio', 'my_name'],
  },
  {
    id: '3',
    name: 'First Follow-Up',
    category: 'follow_up',
    subject: "Re: {{company}}'s website",
    body: `Hi {{first_name}},\n\nJust following up on my last email — still happy to help if the timing is right.\n\n— {{my_name}}`,
    variables: ['first_name', 'company', 'my_name'],
  },
  {
    id: '4',
    name: 'Second Follow-Up',
    category: 'follow_up',
    subject: 'Last follow-up — {{company}}',
    body: `Hi {{first_name}},\n\nI know inboxes get busy — this will be my last follow-up.\n\nIf you ever need a fast, modern website built, I'm happy to help.\n\n{{my_portfolio}}\n\n— {{my_name}}`,
    variables: ['first_name', 'company', 'my_portfolio', 'my_name'],
  },
]
```

### Files to Create/Modify
```
CREATE: src/components/emails/TemplateManager.tsx
CREATE: src/components/emails/TemplateCard.tsx
CREATE: src/components/emails/TemplateModal.tsx
CREATE: src/components/emails/VariableChips.tsx
MODIFY: src/pages/EmailsPage.tsx — replace basic template list
```

---

## Phase 4 — Create Campaign Wizard

### Goal
4-step wizard modal from `+ New Campaign`.

### Wizard Shell
- shadcn/ui Dialog (full-width mobile, max-w-2xl desktop)
- Progress bar: Step X of 4
- Step label: "Step 1 — Campaign Details"
- Back / Next buttons in footer
- X close → confirmation if any field is filled

### Step 1 — Campaign Details
| Field | Type | Validation |
|-------|------|-----------|
| Campaign Name | Text | Required, min 3 chars |
| Description | Textarea | Optional |
| Daily Send Limit | Number | 10–200, default: 50 |
| Start Date | Date picker | Default: today |

Warning if limit > 100:
> "High send volume may increase spam risk for new domains. We recommend starting at 50/day."

### Step 2 — Select Template
- Grid of templates from Phase 3 mock data
- Single select (radio-style)
- "Create New Template" → opens Template Modal inline
- Required to proceed

### Step 3 — Select Prospects
Embeds Phase 5 `ProspectSelector` component.
- Only prospects where `email IS NOT NULL`
- Filters: Country | Industry | Seniority | Status
- Warning if > 200: "Large batches may take several days to complete"
- 📧 badge if already in Active campaign

### Step 4 — Review & Launch
```
Campaign Name:    US Small Business Outreach
Template:         No Website — Cold Outreach
Recipients:       142 prospects
Daily Limit:      50 emails/day
Est. Completion:  3 days (ceil(142 ÷ 50))
Start Date:       June 17, 2026
```

Footer:
- `Save as Draft` → status: `'draft'`
- `Launch Campaign` → status: `'active'` + success toast

### Edit Mode (Re-opening Wizard)
When `Edit` is clicked from Campaign Table:
- Same wizard re-opens with **all fields pre-filled** from existing campaign data
- All campaign fields exist in `email_campaigns` table — safe to pre-fill
- Progress bar replaced with header: "Edit Campaign"
- Footer buttons: `Cancel` | `Save Changes`
- Step 4 (Review) shown first, with "Edit Details" link → jumps to Step 1

### Files to Create
```
CREATE: src/components/emails/CreateCampaignWizard.tsx
CREATE: src/components/emails/wizard/WizardShell.tsx
CREATE: src/components/emails/wizard/StepDetails.tsx
CREATE: src/components/emails/wizard/StepTemplate.tsx
CREATE: src/components/emails/wizard/StepProspects.tsx
CREATE: src/components/emails/wizard/StepReview.tsx
```

---

## Phase 5 — Prospect Selector Component

### Goal
Reusable prospect picker for Campaign Wizard Step 3 and standalone use.

### Features
- Same structure as ProspectsPage table
- Leading checkbox column
- Filters: Country | Industry | Seniority | Email Status
  - All filters use lookup tables (`prospects_country`, `prospects_industry`, `prospects_email_status`)
- Search: by fullname, email, company (uses `search_vector`)
- Pagination: 25 per page

### Cross-Page Selection (Critical)
> ⚠️ `prospects.id` is `bigint` → store selection as `Set<number>` not `Set<string>`

- "Select All Filtered" selects **ALL prospects matching current filters across all pages**
  (not just visible 25)
- Counter reflects total selected across all pages
- If user manually unchecks one prospect, then hits "Select All Filtered" again
  → resets to all filtered (bulk override behavior)
- Selection persists when navigating between pages

### Table Columns
```
[ ] | Full Name | Job Title | Company | Email | Country | Status
```

### Selection Rules
- Grayed out + tooltip `"No email available"` if `email IS NULL`
- 📧 badge if prospect already in an Active campaign

### Sticky Counter Badge
```
[ 142 prospects selected ]  [Clear]  [Confirm Selection →]
```

### Files to Create
```
CREATE: src/components/prospects/ProspectSelector.tsx
CREATE: src/hooks/useProspectSelection.ts
         — internal state: selectedIds: Set<number>
```

---

## Phase 6 — Campaign Detail & Stats Page

### Goal
Page at `/emails/campaigns/:id`.

### Page Layout

#### Header
- `← Campaigns` back link
- Campaign name (h1) + status badge
- Action buttons (permission-gated same as Phase 2)

#### Stats Row — 8 Cards
| Metric | Mock Value |
|--------|------------|
| Total Recipients | 150 |
| Sent | 98 |
| Pending | 52 |
| Opened | 27 (27.6%) |
| Clicked | 12 (12.2%) |
| Replied | 6 (6.1%) |
| Bounced | 2 (2.0%) |
| Unsubscribed | 1 (1.0%) |

#### Activity Chart (Recharts LineChart)
- X axis: date labels
- Y axis: count
- Line 1 (blue): Sent/day
- Line 2 (green): Opened/day
- Tooltip on hover, legend below

**Mock chart data (use exactly this):**
```typescript
const mockActivityData = [
  { date: '2026-06-10', sent: 20, opened: 5 },
  { date: '2026-06-11', sent: 25, opened: 8 },
  { date: '2026-06-12', sent: 18, opened: 6 },
  { date: '2026-06-13', sent: 22, opened: 10 },
  { date: '2026-06-14', sent: 13, opened: 4 },
  { date: '2026-06-15', sent: 0,  opened: 0 },
  { date: '2026-06-16', sent: 0,  opened: 0 },
]
```

#### Recipient Table
| Column | Description |
|--------|-------------|
| Full Name | `prospects.fullname` |
| Company | `prospects.company` |
| Email | `prospects.email` |
| Country | `prospects.country` |
| Status | Badge via `getStatusBadgeClass()` |
| Last Activity | `formatDate()` + `formatTime()` |
| Pipeline Stage | Deal stage if deal exists |

#### Tabs
All | Sent | Opened | Replied | Bounced
(clicking filters recipient table)

### Files to Create
```
CREATE: src/pages/CampaignDetailPage.tsx
CREATE: src/components/emails/CampaignStatsRow.tsx
CREATE: src/components/emails/CampaignActivityChart.tsx
CREATE: src/components/emails/RecipientTable.tsx
MODIFY: React Router — add /emails/campaigns/:id route
```

---

## Phase 7 — Email Compose Upgrade

### Goal
Upgrade existing Compose panel.

### New Features

#### Template Picker
- Dropdown at top: "Use a template..."
- Templates grouped by category
- On select: auto-fills Subject + Body → toast "Template applied"
- If prospect linked → variables auto-resolve

#### Prospect Linker
- "To (Prospect)" field above Subject
- Searchable by name/email/company
- On select: `To:` auto-fills with `prospect.email`
- All `{{variables}}` resolve with prospect data

#### Variable Preview
- Toolbar toggle: `[ ] Preview`
- ON: textarea → rendered HTML, unresolved vars in **orange**
- OFF: back to editable

#### Send Options
- `Send Now` (existing)
- `Schedule Send` — date + time picker
- Scheduled: shows clock icon in Sent tab
- > Frontend only — no actual sending in this phase

### Files to Modify/Create
```
MODIFY: src/components/emails/ComposePanel.tsx
CREATE: src/components/emails/TemplatePicker.tsx
CREATE: src/components/emails/ProspectLinker.tsx
CREATE: src/components/emails/VariablePreview.tsx
```

---

## Phase 8 — Sending Schedule UI

### Goal
New "Email Outreach" tab in Settings page.

### Location
`/settings` → new tab: "Email Outreach"

### Sections

#### Section 1 — Sender Identity
| Field | Default |
|-------|---------|
| Sender Name | Peter Lazan |
| Sender Email | peter@lazandev.dev |

#### Section 2 — Daily Send Controls
- **Daily Limit**: Slider, 10–500 (step: 5, default: 50)
  - Warning at > 200: "High volume may trigger spam filters"
- **Send Window**: Time range
  - From: 09:00 AM | To: 05:00 PM
  - Timezone: dropdown (default: Asia/Manila)
  - **Validation**: "From" must be earlier than "To"
    → toast error if invalid: `"Send window start time must be before end time."`
  - Values map to `send_from_hour` and `send_to_hour` integers (0–23)

#### Section 3 — Sending Days
```
[✅] Mon  [✅] Tue  [✅] Wed  [✅] Thu  [✅] Fri  [ ] Sat  [ ] Sun
```

#### Section 4 — Warm-up Mode
- Toggle: "Enable gradual warm-up"
- When ON: static bar chart showing:
  ```
  Day 1: 10  Day 2: 20  Day 3: 30 ... until daily limit reached
  ```
  Calculated from: `Math.ceil(daily_limit / 10)` days to ramp
- > Frontend only — no actual ramp logic in this phase

#### Section 5 — Unsubscribe Footer
- Toggle: "Add unsubscribe footer to all outreach emails"
- Editable textarea (default text):
  ```
  To unsubscribe from these emails, reply with "unsubscribe".
  ```

#### Footer
- `Save Settings` → Sonner toast: "Outreach settings saved"

### Files to Create/Modify
```
MODIFY: src/pages/SettingsPage.tsx — add tab
CREATE: src/components/settings/EmailOutreachSettings.tsx
CREATE: src/components/settings/WarmupChart.tsx
```

---

## Phase 9 — Pipeline Auto-Update UI

### Goal
Visual indicators showing email-driven stage changes.

### ⚠️ Frontend Simulation Only
This phase is **display logic only**. No deal mutations, no backend calls.
The frontend reads `lastEmailEvent` from mock data and displays the corresponding
stage name. No actual pipeline stage is written in this phase.

### Email Event → Stage Display Map
| Email Event | Stage Shown | Color |
|-------------|-------------|-------|
| sent | New Lead | gray |
| opened | Contacted | blue |
| clicked | Contacted | blue |
| replied | Qualified | green |
| meeting booked | Proposal Sent | purple |

### UI Changes — 3 Areas

#### 1. Prospects Table — "Last Campaign" Column
Add after Status column:
```
| Last Campaign Activity                |
| US Outreach · Opened · Jun 12        |
| Canada Pitch · Replied · Jun 14      |
| —                                     |
```
Clicking → navigates to Campaign Detail page

#### 2. Pipeline Kanban — Campaign Badge
On each deal card (if created via campaign):
- Badge: `📧 Via Campaign`
- Clickable → Campaign Detail page
- Tooltip: "This deal was created from campaign: [campaign name]"

#### 3. Prospect Detail Sheet — Campaign Activity Feed
New section inside existing right-side detail sheet:
```
📤 Jun 10 10:00 AM — Email sent via "US Small Business Outreach"
👁️ Jun 11 2:30 PM  — Email opened (2 times)
🔗 Jun 11 2:31 PM  — Link clicked
💬 Jun 14 9:00 AM  — Reply received → Deal created in Qualified stage
```

Timeline item:
- Icon (📤 👁️ 🔗 💬 ↩️)
- `formatDate()` + `formatTime()`
- Description
- Campaign name (clickable link)

### Files to Create/Modify
```
CREATE: src/components/prospects/CampaignActivityFeed.tsx
CREATE: src/components/deals/CampaignBadge.tsx
MODIFY: src/pages/ProspectsPage.tsx — add Last Campaign column
MODIFY: src/components/prospects/ProspectDetailSheet.tsx — add feed section
MODIFY: src/components/deals/DealCard.tsx — add campaign badge
```

---

## Execution Order

| Order | Phase | Complexity |
|-------|-------|-----------|
| 0 | Pre-Phase: Create campaign-utils.ts | Trivial |
| 1 | Phase 1 — Custom Export Column Selector | Low |
| 2 | Phase 3 — Template Manager Upgrade | Medium |
| 3 | Phase 2 — Campaign List Page | Medium |
| 4 | Phase 4 — Create Campaign Wizard | High |
| 5 | Phase 5 — Prospect Selector | Medium |
| 6 | Phase 6 — Campaign Detail & Stats | High |
| 7 | Phase 7 — Email Compose Upgrade | Medium |
| 8 | Phase 8 — Sending Schedule UI | Low |
| 9 | Phase 9 — Pipeline Auto-Update UI | Medium |

> **START WITH PRE-PHASE** — create `campaign-utils.ts` first.
> Then Phase 1 — Custom Export Column Selector.
> Stop and report after each phase. Await "Yes, Proceed" before continuing.
