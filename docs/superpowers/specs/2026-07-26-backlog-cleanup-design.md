# Backlog Cleanup (Template Variables, Paul CRM Rename, Cosmetic Colors/Docs) — Design

**Date:** 2026-07-26
**Source:** Full-codebase backlog scan from 2026-07-25 (see `project_backlog_2026-07-25` memory record). Three items, confirmed still present in code as of this session.

## Scope

Three independent, low-risk cleanups, each shippable on its own:

1. Template-variables-wiped bug
2. Completing the "Paul CRM" rename (leftover `brisk`-named refs)
3. Cosmetic leftover brand colors + two stale README doc sections

Explicitly **out of scope** (deferred, each deserves its own future brainstorm/spec):
- Wiring `ProspectDetailSheet`'s Notes tab to the real `notes.service.ts` backend (currently hardcoded local mock state)
- Wiring `CommandPalette` to live prospect/deal search (currently searches hardcoded `MOCK_PROSPECTS`/`MOCK_DEALS`/`MOCK_USERS`)

## Phase 1 — Template variables bug fix

**Problem:** `TemplateModal.tsx:81` hardcodes `variables: []` on every save (create and edit), unconditionally. Downstream, `TemplateCard.tsx` and `TemplateListRow.tsx` read `template.variables` purely for display (a badge/count of detected merge fields) — it has no effect on actual send-time resolution, which is handled separately and correctly by `resolveMergeFields()`. So this is a real-but-cosmetic bug: every UI-saved template shows "0 vars" regardless of what merge fields it actually uses.

**Fix:** Compute the variables array at save time instead of hardcoding it. Reuse the canonical `MERGE_FIELDS` list from `src/lib/mergeFields.ts` (the same source `VariableChips.tsx` already draws from) — filter to the keys whose `{{key}}` token literally appears in the submitted `subject` + `body`, in `MERGE_FIELDS` order.

```ts
import { MERGE_FIELDS, resolveMergeFields } from '@/lib/mergeFields'
// ...
function onSubmit(values: FormValues) {
  // ...existing dupe check...
  const haystack = `${values.subject} ${values.body}`
  const variables = MERGE_FIELDS.filter(f => haystack.includes(`{{${f.key}}}`)).map(f => f.key)
  onSave({ name: values.name.trim(), category: values.category, subject: values.subject, body: values.body, variables })
  setDirty(false)
}
```

**Why this approach over alternatives:** An alternative would be a generic regex extracting *any* `{{...}}` token, recognized or not. Rejected — unrecognized tokens wouldn't resolve at send time anyway, so surfacing them as "variables" would be misleading. Matching against the same canonical list used for resolution keeps the badge truthful by construction.

**Files touched:** `src/components/emails/TemplateModal.tsx` only.

**Verification:** Manual — create a template using 2-3 merge-field chips, save, confirm the badge count on the template card/list row matches. Edit an existing MCP-created template (already has correct variables) and re-save without changing the body — confirm variables aren't blanked.

## Phase 2 — Complete the Paul CRM rename

**Problem:** The frontend rebrand (commit `1560233`) missed 15 leftover `brisk`-named references, confirmed still present:

- Functionally meaningful (storage key names): `src/lib/auth.ts` (`brisk_remember_me`, `brisk_session_active`), `src/hooks/useSidebarLists.ts` (`brisk_favorites`, `brisk_projects`), `src/pages/DashboardPage.tsx` (`brisk_dashboard_widgets`), `src/components/search/CommandPalette.tsx` (`brisk_recent_searches`)
- Cosmetic-but-visible: `src/constants/mockData.ts` (5× `@briskcrm.com` seed emails), `src/pages/auth/LoginPage.tsx` (3× `@briskcrm.com` demo-login emails), `src/components/layout/Topbar.tsx` (1× `@briskcrm.com` fallback email)

**Fix:**
- **Clean cutover** on all 6 storage keys — rename the string literals to `paul_*` equivalents (`paul_remember_me`, `paul_session_active`, `paul_favorites`, `paul_projects`, `paul_dashboard_widgets`, `paul_recent_searches`). No read-old/migrate-then-delete logic. This is a deliberate, explicit decision: existing `brisk_*` browser data (yours, most likely the only real instance) is simply abandoned — favorites/projects list resets to empty, dashboard widgets reset to default, recent searches clear, and the "remember me" / active-session state resets (one re-login required). Acceptable since this is pre-launch.
- **Cosmetic swap**: `@briskcrm.com` → `@paulcrm.com` in all 9 remaining spots, matching the domain convention already established in `src/constants/mockEmails.ts`.

**Files touched:** `src/lib/auth.ts`, `src/hooks/useSidebarLists.ts`, `src/pages/DashboardPage.tsx`, `src/components/search/CommandPalette.tsx`, `src/constants/mockData.ts`, `src/pages/auth/LoginPage.tsx`, `src/components/layout/Topbar.tsx`.

**Explicitly not touched** (per the 2026-07-25 backlog scan, deliberately deferred backend-rename scope): 4 outbound "From" display names and 3 OAuth consent-screen text copies — already resolved separately by the Resend outreach session (display names) or tracked as open in `project_backlog_2026-07-25` (OAuth consent screens).

**Verification:** `grep -ri brisk src/` returns zero results afterward. Manual: reload the app once, confirm login still works and the app doesn't crash on the now-empty favorites/projects/widgets state (expect a graceful empty/default state, not an error — worth a quick look at each hook's fallback-on-missing-key behavior while editing, though no code changes are expected there since `JSON.parse(null ?? '[]')`-style fallbacks should already handle a missing key the same as they handle first-ever-load today).

## Phase 3 — Cosmetic colors + doc gaps

**Problem A (colors):** Leftover indigo brand colors from before the Signal-palette rebrand (commit `8e2d691`), confirmed still present as literal hex:
- `public/favicon.svg` — gradient stops `#818cf8` → `#4f46e5`
- `src/components/emails/ComposeModal.tsx` — 3 occurrences of `#4f46e5` baked into outbound newsletter/promo email HTML strings
- `src/components/reports/RevenueOverTime.tsx` — 3 occurrences of `#6366f1` (gradient stops + line stroke)
- `src/components/emails/CampaignStats.tsx` — 1 occurrence of `#6366f1` (bar fill)
- `src/components/reports/LeadsReport.tsx` — 1 occurrence of `#6366f1` (bar fill, line 73 — distinct from the `COLORS` categorical array on line 10, which is left untouched since it's a legitimate 7-color palette that happens to share one hex)

**Fix:** Replace all of the above with `#0c7c8d` — the hex equivalent of this project's `--brand-500` light-mode token (`hsl(188, 84%, 30%)`), computed directly from `src/styles/globals.css`. Kept as a literal hex (not a CSS var) everywhere, matching the existing pattern — required for `ComposeModal.tsx` since email clients don't support `hsl(var(--x))`, and consistent to apply the same literal in the chart files rather than mixing token-based and literal approaches.

**Problem B (docs):**
- `supabase/functions/crm-mcp/README.md`: intro line says "Brisk CRM's data" (rename miss); Deploy section (steps 1-2) instructs pasting individual modular files (`index.ts`, `auth.ts`, `jsonRpc.ts`, etc.) while preserving the `tools/` folder structure — but the actual deploy target is the single-file `DEPLOY_BUNDLE.ts` (confirmed present, 1080 lines). Also never states the tool count (confirmed actual count: 21 tools, across 10 files under `tools/`).
- `mcp-server/README.md`: intro line says "Brisk CRM's core data" (rename miss).

**Fix:**
- Colors: literal hex swap in the 5 files listed above, no logic changes.
- `crm-mcp/README.md`: fix "Brisk CRM" → "Paul CRM" in the intro; rewrite the Deploy section's steps 1-2 to describe pasting `DEPLOY_BUNDLE.ts`'s contents as the single deployed file (not per-module paste-and-preserve-folder-structure); add a line stating the tool count (21).
- `mcp-server/README.md`: fix "Brisk CRM" → "Paul CRM" in the intro.

**Files touched:** `public/favicon.svg`, `src/components/emails/ComposeModal.tsx`, `src/components/reports/RevenueOverTime.tsx`, `src/components/emails/CampaignStats.tsx`, `src/components/reports/LeadsReport.tsx`, `supabase/functions/crm-mcp/README.md`, `mcp-server/README.md`.

**Verification:** Visual check the favicon still renders correctly (rounded-square "B" mark, just recolored). `grep -rE "4f46e5|6366f1|818cf8" src/ public/` returns zero results. Manual read-through of the edited `crm-mcp/README.md` Deploy section against the actual `DEPLOY_BUNDLE.ts` file to confirm the instructions now match reality.

## Testing strategy overall

This project has no frontend test framework (confirmed in `project_phases` memory) beyond the one-off `scripts/verify-*.mjs` pattern used for pure-logic modules. None of these three phases introduce new pure-logic modules worth a script-based check — Phase 1's fix is a 2-line change inside an existing form handler, Phases 2-3 are rename/literal-value swaps. Verification is manual (grep for absence of old strings/values, visual/functional spot-check) as described per-phase above, plus the standard `npm run build` / `npx tsc --noEmit` gate before marking any phase done.

## Rollout

Three independent commits (one per phase), each following the project's existing phase-gate convention: implement → build/typecheck clean → manual verification → stop and report → wait for explicit "Continue with the Next Phase?" confirmation before starting the next.
