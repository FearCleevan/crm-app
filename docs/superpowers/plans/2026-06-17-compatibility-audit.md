# Brisk CRM Upgrade — Compatibility Audit

> Cross-reference of `BRISK_CRM_MASTER_FRONTEND.md` + `BRISK_CRM_MASTER_BACKEND.md`
> against the live codebase and `crm-schema.sql`. Last reviewed: 2026-06-17.

---

## 1. Stack Version Mismatches (Non-Breaking)

The spec headers describe an older stack. The actual codebase is newer — no breaking changes, but any Claude/agent session should use the real versions.

| What | Spec Says | Actual | Risk |
|---|---|---|---|
| React | 18 | **19.2** | None |
| TypeScript | 5 | **~6.0** | None |
| Vite | 6 | **8** | None |
| React Router | v6 | **v7** | None — Data Router API identical for these use cases |

---

## 2. Route Architecture — Important Design Decision

**Spec intent:** "New page at `/emails/campaigns`" and `/emails/campaigns/:id`

**Current EmailsPage reality:** Campaigns are rendered as an **internal tab** (`view === 'campaigns'`) inside `EmailsPage`, not as separate routes. The existing `<CampaignStats />` component is mounted inline.

**Decision required — two valid options:**

| Option | How | Trade-off |
|---|---|---|
| A (recommended) | Keep campaigns as internal views in `EmailsPage`. Replace `<CampaignStats>` with `<CampaignListView>` and add a campaign detail panel/sheet within the page | No router changes. Consistent with existing email tab pattern. Simpler. |
| B (spec literal) | Add `/emails/campaigns` and `/emails/campaigns/:id` as real routes in `App.tsx` | Campaigns become bookmarkable URLs. Requires breaking EmailsPage tab pattern. |

**The frontend plan adopts Option A** (internal view) to avoid restructuring the established tab pattern. If Option B is needed, the only delta is: add two new routes to `App.tsx` and change the `setView('campaigns')` calls to `navigate('/emails/campaigns')`.

---

## 3. Schema Compatibility

### 3a. Critical Type Mismatch — `deals.prospect_id`

```sql
prospects.id          BIGINT     -- 64-bit
deals.prospect_id     INTEGER    -- 32-bit (FK to prospects.id!)
activities.prospect_id BIGINT    -- correct
campaign_recipients.prospect_id BIGINT -- correct (backend migration)
```

`deals.prospect_id` is `integer` but references `prospects.id` which is `bigint`. Works in PostgreSQL for prospect IDs up to 2,147,483,647 (51k rows is fine). TypeScript must type `deals.prospect_id` as `number` and never use `BigInt`. The backend plan's `autoPipelineUpdate` correctly passes `prospectId: number` — no action needed.

### 3b. Missing Unique Constraint on `integrations(user_id, provider)`

The backend plan upserts with `onConflict: 'user_id,provider'` but the schema has **no such unique constraint**. Migration B1 must add it, otherwise the upsert will fail silently and create duplicate rows.

```sql
-- Must be added in Migration 005 or a separate Migration 006
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_user_provider_unique
  UNIQUE (user_id, provider);
```

### 3c. `email_templates.category` CHECK Constraint

Current allowed values: `general, follow_up, introduction, proposal, closing, re_engagement, newsletter`

New values needed (Phase 3 / Migration 004): `cold_outreach, no_website, outdated_website`

**Migration 004 correctly handles this** — drops and recreates the CHECK constraint. ✅

### 3d. `email_templates` FK Column

The `email_templates` table uses `created_by uuid` (references `crm_users.id`), **not** `user_id`. The backend plan's `templateService.ts` correctly uses `created_by`. ✅

However, Migration 004 adds a `user_id` column to `email_templates` in addition to `created_by`. This creates ambiguity. **Recommendation:** Skip the `user_id` ADD COLUMN in Migration 004 and only use the existing `created_by` column throughout. The frontend mock data doesn't need it, and the backend service already uses `created_by`.

### 3e. `prospects.search_vector` — Already Indexed

Phase 5 ProspectSelector needs full-text search. The `search_vector` tsvector column with GIN index already exists and is used by `prospectsService`. The ProspectSelector can reuse `useProspects` hook directly. ✅

### 3f. `activities` Table — `prospect_id` Already Exists

The backend plan logs to `activities` with `prospect_id bigint`. The column already exists as a nullable bigint FK in the schema. ✅

### 3g. `pipeline_sessions` — Uses `auth.users` not `crm_users`

`pipeline_sessions.user_id` references `auth.users(id)`, not `crm_users(id)`. Not relevant to the upgrade but worth noting for any pipeline work.

---

## 4. Codebase Compatibility

### 4a. Phase 1 — Export Column Selector

`ProspectsPage.tsx` already imports `Papa from 'papaparse'` and has a working export function. It also already imports `ALL_COLUMNS` from `ProspectsTable`. Phase 1 adds `ExportColumnModal` and replaces the direct `Papa.unparse()` call with a modal trigger. ✅ Minimal surgery.

### 4b. Phase 3 — Template Manager

`EmailsPage.tsx` already has `useTemplatesState()` managing `MOCK_TEMPLATES`. Phase 3 replaces the `<TemplatesPanel>` component. The mock template state stays in `EmailsPage`; the new `TemplateManager` is a drop-in replacement that receives the same props. ✅

### 4c. Phase 2 — Campaign List

`EmailsPage.tsx` already has `view === 'campaigns'` rendering `<CampaignStats />`. Phase 2 replaces `<CampaignStats />` with `<CampaignListView>`. ✅ One-line swap.

### 4d. Phase 4 — Campaign Wizard

The wizard is a modal (`CreateCampaignWizard`) triggered from `<CampaignListView>`. No routing changes needed. Mock state lives in `EmailsPage` alongside email/template state. ✅

### 4e. Phase 5 — Prospect Selector

Reuses `useProspects` hook (already handles pagination, search, filters). The only new thing is the multi-page `Set<number>` selection state (`useProspectSelection` hook). `prospects.id` is typed as `number` throughout the existing codebase (see `useProspects.ts` — `remove(id: number)`, `bulkRemove(ids: number[])`). ✅

### 4f. Phase 8 — Settings Tab

`SettingsPage.tsx` uses a tab-based layout. Adding an "Email Outreach" tab follows the existing `ProfileTab`, `SecurityTab`, `ApiTab`, `SystemTab` pattern. ✅

### 4g. Phase 9 — Pipeline Badge

`DealCard.tsx` needs a `campaignBadge?` prop. `ProspectDetailSheet.tsx` needs a campaign activity section. Both are additive changes with no breaking side-effects. ✅

---

## 5. Permissions — No New Keys Needed

The spec's role matrix for campaign features maps cleanly to existing permissions:

| Campaign feature | Existing permission to gate on |
|---|---|
| View campaigns | `emails_view` |
| Create/edit campaign | `emails_send` |
| Delete campaign | (Super Admin only — use `role === 'Super Admin'` check) |
| Export columns | Existing `leads_export` |
| Outreach settings | `settings_manage` |

No new permission keys need to be added to `src/constants/roles.ts`.

---

## 6. `VITE_API_KEY` and `VITE_WEBHOOK_URL` in `.env.local`

These are not read by any source file in the current codebase. The upgrade plan does not add them. Backend Resend API key is stored in Supabase Vault (not a Vite env var). These can be removed from `.env.local` or left blank — either is fine.

---

## 7. No Test Framework

The project has no `vitest`, `jest`, or `@testing-library` in `package.json`. All "test" steps in the implementation plans use:
1. `npm run build` — TypeScript compile + Vite production build (catches all type errors)
2. `npm run dev` + manual browser verification for UI behaviour

---

## 8. Frontend Mock Data Gaps — Items to Verify

These mock constants are referenced in the spec but their current state needs checking before Phase 2:

| Constant | Current location | Used in plan |
|---|---|---|
| `MOCK_TEMPLATES` | `src/constants/mockEmails.ts` | Phase 3 replaces with richer mock |
| `MOCK_EMAILS` | `src/constants/mockEmails.ts` | Not changed |
| `mockCampaigns` | Doesn't exist yet | Phase 2 creates inline |

---

## 9. Summary: Go / No-Go per Phase

| Phase | Verdict | Notes |
|---|---|---|
| Pre-Phase 0 | ✅ Go | New file, no conflicts |
| Phase 1 | ✅ Go | Small modification to ProspectsPage |
| Phase 3 | ✅ Go | Replace TemplatesPanel component |
| Phase 2 | ✅ Go | Replace CampaignStats view |
| Phase 4 | ✅ Go | New wizard modal |
| Phase 5 | ✅ Go | New selector reusing existing hook |
| Phase 6 | ✅ Go | New view inside EmailsPage (or new route — see §2) |
| Phase 7 | ✅ Go | Extend ComposeModal |
| Phase 8 | ✅ Go | New settings tab |
| Phase 9 | ✅ Go | Additive UI indicators |
| B1 Schema | ⚠️ Action needed | Add `integrations` unique constraint; skip `email_templates.user_id` column |
| B2 RLS | ✅ Go | Standard patterns |
| B3 Resend | ✅ Go | Uses existing `integrations` table |
| B4–B5 Edge Fn | ✅ Go | Standard Deno/Supabase pattern |
| B6–B7 Services | ✅ Go | Standard service layer pattern |
| B8 Export | ✅ Go | No backend needed; client-side only |
| B9 Pipeline | ✅ Go | `deals.prospect_id` integer type is safe for 51k rows |
| B10 pg_cron | ✅ Go | Standard Supabase cron pattern |
| B11 Settings | ⚠️ Action needed | Add unique constraint first (§3b) |
