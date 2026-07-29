# Mock Data Replacement — Backend Implementation Plan

Full design/rationale: `docs/superpowers/specs/2026-07-28-mockdata-replacement-design.md`

Execution rule: one phase at a time. Stop after each phase, report status, wait for explicit
"Yes, Proceed" before starting the next.

Good news: Phases 1-4 need **no new migrations**. The `activities` table (see
`supabase/schema/crm-schema.sql`) already has `type CHECK (type = ANY (ARRAY['call','email',
'meeting','task','note','status']))`, `prospect_id`, `title`, `description`, `status`,
`created_by`, `created_at` — everything Notes/Activity/Calls need already exists.

---

## Phase 1 — Delete dead mock code

No backend changes. Frontend-only.

---

## Phase 2 — CommandPalette real search

No schema changes. Confirm `dealsService.getDeals()` actually supports a `search` param (design
doc flagged this as needing confirmation) — if it doesn't, add one (ilike match on `name`/
`company`, same pattern as `prospects.service.ts`'s existing search handling). No migration
needed either way — this is a query-layer change in `deals.service.ts` only if the param is
missing.

---

## Phase 3 — ProspectDetailSheet Notes tab

`notes.service.ts`'s `getNotes(filter, search, page)` currently supports `filter: 'prospect'` but
that only checks `prospect_id is not null` — it does **not** scope to a *specific* prospect. Add
one of:
- A `prospect_id` param to `getNotes` (`.eq('prospect_id', prospectId)` when provided), or
- A small dedicated method, e.g. `getNotesForProspect(prospectId: number)`.

Prefer the dedicated method — keeps the existing `getNotes` (used by the standalone Notes page)
untouched and avoids adding an optional param that only one caller uses.

`createNote` already accepts `prospect_id` and `created_by` — no changes needed there.

No new tables/migrations. RLS on `activities` already exists (check `crm-schema.sql` policies)
and should already permit read/insert by prospect_id the same way it does for the general Notes
page — verify during implementation, don't assume.

---

## Phase 4 — Activity + Calls tabs

Add a small `activitiesService` (or extend `notes.service.ts` — team's call at implementation
time) with:
- `getActivitiesForProspect(prospectId: number): Promise<ActivityRow[]>` — all types, ordered by
  `created_at desc`.
- `createActivity(payload: { type: 'call'; title: string; description?: string; status?: string;
  prospect_id: number; created_by: string })` — for logging a call from the UI.

No migration needed — `type = 'call'` is already a valid value in the existing CHECK constraint.
Reuse the same RLS policies already governing `activities` for notes.

---

## Phase 5 — EmailsPage Inbox — RESOLVED 2026-07-29, see EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md

Decision: Gmail API sync, matched-replies-only, polling every ~10 min. This isn't a fresh decision
made in isolation — it's the deferred Phase 0/3/4 of the pre-existing
`EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md` plan (Sent and Drafts phases of that plan were
already done). Full design, migration shape, Edge Function scope, and manual OAuth setup steps are
documented there — this file just cross-references rather than duplicating.
