# Mock Data Replacement — Design

## Background

An audit of `crm-app/src` (grep for `mock`/`MOCK_` across all files, then tracing every hit to its
actual consumers) found the real state is more nuanced than "everything named mock is fake data
on screen":

- Some `MOCK_*` exports are live-rendered fake business data (real bugs).
- Some files/exports are dead code — defined, never imported anywhere that renders (safe deletes,
  not "swaps").
- Some `mock*.ts` files hold legitimate static reference lists (dropdown options) or shared
  TypeScript types, and are not fake data at all despite the filename.
- Two areas show "after backend integration" placeholder text but aren't blocked the way the copy
  implies — the `activities` table already supports `type IN ('call','email','meeting','task',
  'note','status')` with a `prospect_id` column, so Activity/Calls tabs can be wired without new
  migrations.
- One area (Inbox) is genuinely blocked on an undecided architecture question (no email-receiving
  integration exists yet) and is out of scope for this pass beyond flagging it.

## Scope

Five phases, executed one at a time per this project's phase-gate protocol (stop after each,
wait for explicit "Yes, Proceed").

### Phase 1 — Delete dead mock code
No behavior change. Remove:
- `src/constants/mockCampaigns.ts` (unreferenced anywhere)
- `src/components/emails/CampaignStats.tsx` (imports `CAMPAIGN_STATS` from `mockEmails.ts`, never
  rendered by any page)
- `MOCK_REVENUE_DATA`, `MOCK_RETENTION_DATA` from `mockData.ts` (unreferenced)
- `MOCK_NOTIFICATIONS` arrays from both `mockData.ts` and `mockNotifications.ts` (unreferenced —
  `NotificationPanel.tsx` already uses real `notificationsService` + `supabase`, only imports
  *types* from `mockNotifications.ts`)

Leave untouched (false positives, not mock data): `DISPOSITION_CODES`, `EMAIL_STATUSES`,
`PROVIDERS`, `INDUSTRIES`, `COUNTRIES`, `TEMPLATE_CATEGORIES`, workflow label/color maps, and all
`import type` usages of `Prospect`/`Deal`/`CRMUser`/`EmailMessage`/`Workflow`.

### Phase 2 — CommandPalette (⌘K) real search
`src/components/search/CommandPalette.tsx` currently filters `MOCK_PROSPECTS`, `MOCK_DEALS`,
`MOCK_USERS` client-side. Replace with debounced calls to `prospectsService.getProspects({
search, limit })`, `dealsService.getDeals({ search, limit })` (confirm search param support), and
`usersService.getUsers()` (client-filtered, since it's a small table and there's no
`searchUsers`). Keep the same result shape/grouping so the rest of the component (keyboard nav,
recent searches) is untouched.

### Phase 3 — ProspectDetailSheet Notes tab
`src/components/prospects/ProspectDetailSheet.tsx` has a hardcoded `useState<MockNote[]>` with 2
fake notes, and looks up authors/`createdby` via `MOCK_USERS`. Replace with:
- `notesService.getNotes('prospect', ..., prospect_id filter)` — note: current `getNotes` filters
  by presence of `prospect_id`/`deal_id` generically; will need either a prospect-id-specific
  param added to the service or client-side filtering by `n.prospect_id === prospect.id`.
- `notesService.createNote({ prospect_id, created_by, title/description })` for `addNote`.
- `usersService.getUsers()` (or a lighter lookup) to resolve author names and `createdByUser`,
  replacing `MOCK_USERS.find(...)`.

### Phase 4 — ProspectDetailSheet Activity + Calls tabs
Both currently show static "will appear here after backend integration" text. The `activities`
table already has everything needed (`type`, `prospect_id`, `title`, `description`, `status`,
`created_at`). Plan:
- Activity tab: fetch all `activities` rows for this `prospect_id` (any type), rendered as a
  timeline, newest first.
- Calls tab: fetch `activities` rows for this `prospect_id` where `type = 'call'`, plus a small
  form to log a new call (title/description/status → insert row with `type: 'call'`).
- Likely needs a new `activitiesService` (or extend `notes.service.ts`, which already queries this
  same table) rather than duplicating query logic.
- Map view placeholder in the Overview tab is out of scope — it's an unbuilt feature (no
  geocoding), not mock data being displayed as real.

### Phase 5 — EmailsPage Inbox (deferred sub-decision)
`MOCK_EMAILS` still backs the Inbox folder. This needs an explicit decision on where inbox mail
comes from (no receiving integration exists — Sent and Drafts are already real). Per user
direction, this decision is deferred until Phases 1-4 are done; Phase 5 will start with a short
options discussion (e.g., Gmail API sync via the existing outreach account) before any
implementation.

## Testing
No test suite exists in this project (confirmed prior audit). Each phase will be verified via
`npm run build` + `npx tsc --noEmit` (per this project's Definition of Done) plus manual
click-through of the affected UI in the dev server before being marked complete.

## Out of scope
- Rebuilding Activity/Calls as a general-purpose CRM activity system beyond what backs these two
  tabs.
- Any email-provider integration decision (parked for Phase 5 discussion).
- Static reference/config lists — not mock data, no action needed.
