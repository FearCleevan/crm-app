# Mock Data Replacement — Frontend Implementation Plan

Full design/rationale: `docs/superpowers/specs/2026-07-28-mockdata-replacement-design.md`

Execution rule: one phase at a time. Stop after each phase, report status + build output, wait
for explicit "Yes, Proceed" before starting the next.

---

## Phase 1 — Delete dead mock code

**Files to delete:**
- `src/constants/mockCampaigns.ts`
- `src/components/emails/CampaignStats.tsx`

**Files to edit (remove unreferenced exports only):**
- `src/constants/mockData.ts` — remove `MOCK_REVENUE_DATA`, `MOCK_RETENTION_DATA`,
  `MOCK_NOTIFICATIONS`. Keep everything else (`Prospect`, `CRMUser`, `Deal` types,
  `DISPOSITION_CODES`, `EMAIL_STATUSES`, `PROVIDERS`, `INDUSTRIES`, `COUNTRIES`, `MOCK_USERS`,
  `MOCK_PROSPECTS`, `MOCK_DEALS` — those three arrays are still consumed until Phase 2).
- `src/constants/mockNotifications.ts` — remove the `MOCK_NOTIFICATIONS` array, keep the type
  exports (`NotificationCategory`, `NotificationIcon`, `AppNotification`) since
  `NotificationPanel.tsx` imports those.

**Verify:** `npm run build`, `npx tsc --noEmit` — both zero errors. No visual/behavior change
expected anywhere in the app.

---

## Phase 2 — CommandPalette (⌘K) real search

**File:** `src/components/search/CommandPalette.tsx`

- Replace `MOCK_PROSPECTS`/`MOCK_DEALS`/`MOCK_USERS` imports with calls to `prospectsService`,
  `dealsService`, `usersService` (all in `src/services/`).
- Debounce the query (e.g. 200-300ms) before calling the prospect/deal search — these hit the
  network now, unlike the old synchronous array filter.
- Users: no dedicated search method exists on `usersService`; fetch once (or cache) via
  `getUsers()` and filter client-side, matching current behavior.
- Preserve existing UX: same `SearchResult` shape, same grouping/order (Prospects, Deals, Users,
  Pages), same keyboard nav, same "recent searches" localStorage behavior.
- Handle empty/loading states gracefully (e.g., don't flash "no results" before the debounced
  fetch returns).

**Verify:** `npm run build`, `npx tsc --noEmit`. Manually open ⌘K, search a real prospect/deal/user
by name, confirm real records appear and clicking navigates correctly. Confirm Pages section
(static) still works with no query.

---

## Phase 3 — ProspectDetailSheet Notes tab

**File:** `src/components/prospects/ProspectDetailSheet.tsx`

- Remove the hardcoded `useState<MockNote[]>` seed data.
- On mount (or tab activation), fetch real notes scoped to this prospect via `notesService` (see
  backend note below on the query shape needed).
- `addNote()` → `notesService.createNote({ prospect_id: Number(prospect.id), created_by:
  <current user id>, title/description: noteInput })` — need the current user's id (check
  `useCurrentUser` hook, already used elsewhere in this codebase, e.g. `EmailsPage.tsx`).
- Author display and `createdByUser` (used for "created by" on Overview) → replace `MOCK_USERS.find`
  with a real lookup via `usersService.getUsers()` (fetch once, resolve by id — same pattern as
  Phase 2's Users search, consider sharing a small cached hook if it gets duplicated a third time).
- Tab counter (`Notes (${notes.length})`) stays as-is, just now backed by real count.

**Verify:** `npm run build`, `npx tsc --noEmit`. Manually add a note to a real prospect, reload the
sheet, confirm it persists and shows the correct author name. Confirm existing real notes (if any
already exist in `activities` with `type='note'` and a `prospect_id`) show up correctly.

---

## Phase 4 — ProspectDetailSheet Activity + Calls tabs

**File:** `src/components/prospects/ProspectDetailSheet.tsx`

- Activity tab: replace the static placeholder paragraph with a real timeline — all `activities`
  rows for this `prospect_id`, any `type`, newest first. Simple list item: icon by type, title,
  description, relative timestamp (this codebase already uses `date-fns` `formatDistanceToNow`
  elsewhere, e.g. `NotificationPanel.tsx`).
- Calls tab: replace the static placeholder with real `activities` rows where `type = 'call'` for
  this prospect, plus a small inline form (title + optional description + status) to log a new
  call, inserting `type: 'call'`.
- Do not touch the Overview tab's map-view placeholder — explicitly out of scope (not mock data,
  an unbuilt feature).

**Verify:** `npm run build`, `npx tsc --noEmit`. Manually log a call on a real prospect, confirm it
shows in both the Calls tab and the Activity tab (since Activity shows all types). Confirm Notes
added in Phase 3 also show up in the Activity feed (same underlying table).

---

## Phase 5 — EmailsPage Inbox (parked)

Do not start without a fresh discussion — this phase is intentionally undecided pending an
architecture choice (see backend doc). When resumed, this file will be updated with the actual
plan once that decision is made.
