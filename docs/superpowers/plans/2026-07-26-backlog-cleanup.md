# Backlog Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out three confirmed, independent items from the 2026-07-25 backlog scan: the template-variables-wiped display bug, the incomplete "Paul CRM" rename (leftover `brisk`-named refs), and leftover indigo brand colors + two stale README doc sections.

**Architecture:** Three unrelated, independently-shippable tasks touching disjoint file sets. No shared code, no new modules, no new dependencies — every change is a targeted edit to existing files.

**Tech Stack:** Plain TypeScript/React (existing components), one static SVG asset, two Markdown docs. No new libraries.

## Global Constraints

- Each task below is a separate phase per this project's phase-gate convention: implement → `npx tsc -b` (Task 1 and 2 only — Task 3 touches no `.ts`/`.tsx` logic beyond literal string edits, but still run the type-check as a safety net) → manual verification → commit → **STOP and report to the user, wait for explicit "Continue with the Next Phase?" confirmation before starting the next task.** Do not bundle tasks into one commit or run them back-to-back without stopping.
- No frontend test framework exists in this project (confirmed in prior sessions) — verification is `npx tsc -b` plus manual spot-checks as described in each task, no new test scripts needed for these three tasks (none introduce pure-logic modules of the kind `scripts/verify-*.mjs` targets).
- Out of scope for this plan (deferred, per the approved spec): wiring `ProspectDetailSheet`'s Notes tab or `CommandPalette`'s search to real Supabase data — those are separate future features, not touched here.
- Out of scope for Task 2 (per the approved spec): the 4 outbound "From" display names (already fixed in a prior session) and the 3 OAuth consent-screen text copies (still open, tracked separately in project memory, not part of this plan).
- Task 2 is a **clean cutover** on storage keys — no migrate-old-key-then-delete logic. This is deliberate: existing `brisk_*` browser data is abandoned on purpose.
- Brand color replacement value for Task 3: `#0c7c8d` (the hex equivalent of this project's `--brand-500` light-mode CSS token, `hsl(188, 84%, 30%)`) — use this exact value everywhere in Task 3, do not substitute a different shade.

---

### Task 1: Fix template-variables-wiped bug

**Files:**
- Modify: `src/components/emails/TemplateModal.tsx`

**Interfaces:**
- Consumes: `MERGE_FIELDS` from `src/lib/mergeFields.ts` (existing, already exports `MERGE_FIELDS: readonly { key: MergeFieldKey; label: string }[]` — this file already imports `resolveMergeFields` from the same module, so only the import line needs widening).
- Produces: nothing new for later tasks — Task 1 is fully self-contained.

- [ ] **Step 1: Widen the import**

Replace:

```typescript
import { resolveMergeFields } from '@/lib/mergeFields'
```

with:

```typescript
import { MERGE_FIELDS, resolveMergeFields } from '@/lib/mergeFields'
```

- [ ] **Step 2: Compute real variables in `onSubmit` instead of hardcoding `[]`**

Replace:

```typescript
  function onSubmit(values: FormValues) {
    const isDupe = existingNames
      .filter(n => !initial || n !== initial.name)
      .includes(values.name.trim())
    if (isDupe) { alert('A template with this name already exists.'); return }
    onSave({ name: values.name.trim(), category: values.category, subject: values.subject, body: values.body, variables: [] })
    setDirty(false)
  }
```

with:

```typescript
  function onSubmit(values: FormValues) {
    const isDupe = existingNames
      .filter(n => !initial || n !== initial.name)
      .includes(values.name.trim())
    if (isDupe) { alert('A template with this name already exists.'); return }
    const haystack = `${values.subject} ${values.body}`
    const variables = MERGE_FIELDS.filter(f => haystack.includes(`{{${f.key}}}`)).map(f => f.key)
    onSave({ name: values.name.trim(), category: values.category, subject: values.subject, body: values.body, variables })
    setDirty(false)
  }
```

- [ ] **Step 3: Type-check**

Run (from `crm-app/`): `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open the printed local URL, log in.

1. Go to Emails → Templates → New Template. Type a subject/body containing at least two merge-field tokens (e.g. `Hi {{first_name}}, following up with {{company}}`). Save.
2. Confirm the new template's card/list row shows a "2 vars" badge (or the two chips, depending on which view you're in) — not "0 vars" / no badge.
3. Edit that same template (change nothing about the tokens, just re-save) — confirm the variable count is still correct, not wiped back to 0.
4. Edit an existing MCP-created template that already has correct variables (if one exists) and re-save without changing the body — confirm variables aren't blanked.

- [ ] **Step 5: Commit**

```bash
git add src/components/emails/TemplateModal.tsx
git commit -m "fix: stop wiping template variables on every UI save"
```

- [ ] **Step 6: STOP and report**

Report Task 1 complete with the `tsc -b` output and manual-verification results. Wait for the user's explicit "Continue with the Next Phase?" confirmation before starting Task 2.

---

### Task 2: Complete the Paul CRM rename

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/hooks/useSidebarLists.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/search/CommandPalette.tsx`
- Modify: `src/constants/mockData.ts`
- Modify: `src/pages/auth/LoginPage.tsx`
- Modify: `src/components/layout/Topbar.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing for Task 3 — fully independent.

- [ ] **Step 1: `src/lib/auth.ts` — rename the two storage-key constants**

Replace:

```typescript
const LS_REMEMBER = 'brisk_remember_me'
const SS_SESSION  = 'brisk_session_active'
```

with:

```typescript
const LS_REMEMBER = 'paul_remember_me'
const SS_SESSION  = 'paul_session_active'
```

- [ ] **Step 2: `src/hooks/useSidebarLists.ts` — rename the two legacy-migration key constants**

Replace:

```typescript
const LS_FAV  = 'brisk_favorites'
const LS_PROJ = 'brisk_projects'
```

with:

```typescript
const LS_FAV  = 'paul_favorites'
const LS_PROJ = 'paul_projects'
```

- [ ] **Step 3: `src/pages/DashboardPage.tsx` — rename the storage-key constant**

Replace:

```typescript
const STORAGE_KEY = 'brisk_dashboard_widgets'
```

with:

```typescript
const STORAGE_KEY = 'paul_dashboard_widgets'
```

- [ ] **Step 4: `src/components/search/CommandPalette.tsx` — rename the storage-key constant**

Replace:

```typescript
const RECENT_KEY = 'brisk_recent_searches'
```

with:

```typescript
const RECENT_KEY = 'paul_recent_searches'
```

- [ ] **Step 5: `src/constants/mockData.ts` — swap all 5 seed emails to `@paulcrm.com`**

Replace each of the following exact strings (5 occurrences, one per mock user):

```
email: 'janson.williams@briskcrm.com',
```
```
email: 'sarah.chen@briskcrm.com',
```
```
email: 'marcus.torres@briskcrm.com',
```
```
email: 'priya.sharma@briskcrm.com',
```
```
email: 'liam.obrien@briskcrm.com',
```

with (respectively):

```
email: 'janson.williams@paulcrm.com',
```
```
email: 'sarah.chen@paulcrm.com',
```
```
email: 'marcus.torres@paulcrm.com',
```
```
email: 'priya.sharma@paulcrm.com',
```
```
email: 'liam.obrien@paulcrm.com',
```

- [ ] **Step 6: `src/pages/auth/LoginPage.tsx` — swap the 3 demo-login emails**

Replace:

```typescript
const DEMO_ACCOUNTS = [
  { role: 'Super Admin',  email: 'janson.williams@briskcrm.com', password: 'admin123'   },
  { role: 'Data Analyst', email: 'sarah.chen@briskcrm.com',      password: 'analyst123' },
  { role: 'Agent',        email: 'marcus.torres@briskcrm.com',   password: 'agent123'   },
]
```

with:

```typescript
const DEMO_ACCOUNTS = [
  { role: 'Super Admin',  email: 'janson.williams@paulcrm.com', password: 'admin123'   },
  { role: 'Data Analyst', email: 'sarah.chen@paulcrm.com',      password: 'analyst123' },
  { role: 'Agent',        email: 'marcus.torres@paulcrm.com',   password: 'agent123'   },
]
```

- [ ] **Step 7: `src/components/layout/Topbar.tsx` — swap the fallback email**

Replace:

```typescript
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? 'janson@briskcrm.com'}</p>
```

with:

```typescript
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? 'janson@paulcrm.com'}</p>
```

- [ ] **Step 8: Type-check**

Run (from `crm-app/`): `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 9: Confirm no leftover references**

Run (from `crm-app/`): `grep -ri brisk src/`
Expected: no output (zero matches).

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, open the printed local URL.

1. Confirm the login page's demo-account hints now show `@paulcrm.com` addresses.
2. Log in. Expect favorites/projects sidebar lists, dashboard widget layout, and recent searches to all appear empty/default — this is the expected one-time reset from the clean-cutover key rename, not a bug.
3. Add a favorite, toggle a dashboard widget, and run a command-palette search — confirm each still saves/persists correctly under the new key names (reload the page and confirm the state survives the reload).

- [ ] **Step 11: Commit**

```bash
git add src/lib/auth.ts src/hooks/useSidebarLists.ts src/pages/DashboardPage.tsx src/components/search/CommandPalette.tsx src/constants/mockData.ts src/pages/auth/LoginPage.tsx src/components/layout/Topbar.tsx
git commit -m "rebrand: rename remaining brisk_* storage keys and @briskcrm.com refs to Paul CRM"
```

- [ ] **Step 12: STOP and report**

Report Task 2 complete with the `tsc -b` output, the `grep -ri brisk src/` output (confirming zero matches), and manual-verification results. Wait for the user's explicit "Continue with the Next Phase?" confirmation before starting Task 3.

---

### Task 3: Cosmetic colors + doc gaps

**Files:**
- Modify: `public/favicon.svg`
- Modify: `src/components/emails/ComposeModal.tsx`
- Modify: `src/components/reports/RevenueOverTime.tsx`
- Modify: `src/components/emails/CampaignStats.tsx`
- Modify: `src/components/reports/LeadsReport.tsx`
- Modify: `supabase/functions/crm-mcp/README.md`
- Modify: `mcp-server/README.md`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: nothing further — last task in this plan.

- [ ] **Step 1: `public/favicon.svg` — recolor the gradient**

Replace:

```xml
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#4f46e5"/>
```

with:

```xml
      <stop offset="0%" stop-color="#0c7c8d"/>
      <stop offset="100%" stop-color="#0c7c8d"/>
```

- [ ] **Step 2: `src/components/emails/ComposeModal.tsx` — recolor 3 literal hex values in the newsletter/promo email HTML strings**

Replace each exact substring occurrence of `#4f46e5` with `#0c7c8d` (3 occurrences total: the newsletter header background, the promo header background + its CTA button background, and the initials-avatar background). Use a literal find-and-replace on the string `#4f46e5` → `#0c7c8d` across this file — do not touch any other hex value in these HTML strings (e.g. leave `#111827`, `#4b5563`, `#f9fafb`, `#9ca3af`, `#e5e7eb`, `#6b7280`, `#ffffff` untouched).

- [ ] **Step 3: `src/components/reports/RevenueOverTime.tsx` — recolor the area-chart gradient + stroke**

Replace:

```typescript
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
```

with:

```typescript
                <stop offset="5%"  stopColor="#0c7c8d" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0c7c8d" stopOpacity={0.02} />
```

Replace:

```typescript
            <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
```

with:

```typescript
            <Area type="monotone" dataKey="value" stroke="#0c7c8d" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
```

- [ ] **Step 4: `src/components/emails/CampaignStats.tsx` — recolor the bar fill**

Replace:

```typescript
            <Bar dataKey="rate" name="Open Rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
```

with:

```typescript
            <Bar dataKey="rate" name="Open Rate" fill="#0c7c8d" radius={[4, 4, 0, 0]} />
```

- [ ] **Step 5: `src/components/reports/LeadsReport.tsx` — recolor the bar fill only (leave the `COLORS` array untouched)**

Replace:

```typescript
                <Bar dataKey="count" name="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
```

with:

```typescript
                <Bar dataKey="count" name="Leads" fill="#0c7c8d" radius={[4, 4, 0, 0]} />
```

Do not modify line 10 (`const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']`) — this is a legitimate 7-color categorical palette used for the `Cell` chart segments; one of its swatches happens to share the old brand hex but it is not a rebrand leftover.

- [ ] **Step 6: `supabase/functions/crm-mcp/README.md` — fix branding + rewrite the Deploy section**

Replace:

```markdown
A Supabase Edge Function exposing the Brisk CRM's data (prospects, deals, campaigns, notes,
workflows, reports) plus a `send_outreach_email` tool as a remote MCP server, so claude.ai can
be registered as a Custom Connector against it. This is the "v2" companion to the local
Claude Code MCP server in `crm-app/mcp-server/` — see
`docs/superpowers/specs/2026-07-17-mcp-connector-v2-design.md` for the full design.
```

with:

```markdown
A Supabase Edge Function exposing Paul CRM's data (prospects, deals, campaigns, notes,
workflows, reports) plus a `send_outreach_email` tool as a remote MCP server, so claude.ai can
be registered as a Custom Connector against it. This is the "v2" companion to the local
Claude Code MCP server in `crm-app/mcp-server/` — see
`docs/superpowers/specs/2026-07-17-mcp-connector-v2-design.md` for the full design. 21 tools
total, spread across `tools/*.ts`.
```

Replace:

```markdown
## Deploy (Supabase Dashboard — no CLI)

1. Dashboard → Edge Functions → **Deploy a new function**, name it `crm-mcp`.
2. Paste in the contents of every file under `crm-app/supabase/functions/crm-mcp/` (excluding
   `scripts/` and this README — only `index.ts`, `auth.ts`, `jsonRpc.ts`, `supabaseClient.ts`,
   `config.ts`, and `tools/*.ts` are part of the deployed function). Preserve the `tools/`
   subdirectory structure when uploading through the Dashboard editor — those files must stay
   under a `tools/` folder relative to `index.ts`, not be flattened alongside it. Also include
   `deno.json`: it pins the exact dependency versions matching `deno.lock` (the ones this was
   actually tested against). Omitting it still works, since the runtime falls back to resolving
   unpinned versions from the bare `npm:` specifiers, but including it is safer.
```

with:

```markdown
## Deploy (Supabase Dashboard — no CLI)

1. Dashboard → Edge Functions → **Deploy a new function**, name it `crm-mcp`.
2. Paste in the entire contents of `crm-app/supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts` as the
   function's single `index.ts` file. This is a pre-bundled single-file build of everything under
   `index.ts`, `auth.ts`, `jsonRpc.ts`, `supabaseClient.ts`, `config.ts`, and `tools/*.ts` — the
   Dashboard editor does not need (and should not receive) the individual modular files or the
   `tools/` folder structure; deploying the modular files separately is not how this function is
   actually built or tested.
```

Leave the rest of the README (steps 3+, the single-user-scope note, and anything after the Deploy section) untouched — only the intro paragraph and Deploy steps 1-2 change.

- [ ] **Step 7: `mcp-server/README.md` — fix branding**

Replace:

```markdown
A local, stdio-based MCP server exposing the Brisk CRM's core data
(prospects, deals, campaigns, notes, workflows, reports) as tools for
Claude Code. Local-only — uses the Supabase `service_role` key, bypasses
RLS, and is meant to be run by one developer on their own machine.
```

with:

```markdown
A local, stdio-based MCP server exposing Paul CRM's core data
(prospects, deals, campaigns, notes, workflows, reports) as tools for
Claude Code. Local-only — uses the Supabase `service_role` key, bypasses
RLS, and is meant to be run by one developer on their own machine.
```

- [ ] **Step 8: Type-check**

Run (from `crm-app/`): `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 9: Confirm no leftover old hex values**

Run (from `crm-app/`): `grep -rE "4f46e5|6366f1|818cf8" src/ public/`
Expected: no output (zero matches).

- [ ] **Step 10: Manual verification**

1. Open `public/favicon.svg` in a browser tab (or via `npm run dev` and checking the browser tab icon) — confirm the "B" mark still renders correctly, just in teal instead of indigo.
2. Open Emails → Compose, apply the Newsletter and Promo presets, confirm the header/CTA background now renders teal (`#0c7c8d`), not indigo.
3. Open Reports, confirm the Revenue-over-time area chart and Leads bar chart now render in teal.
4. Open Emails → Campaigns → a campaign's stats view, confirm the Open Rate bar renders in teal.
5. Read through the edited `crm-mcp/README.md` Deploy section once more against the actual `DEPLOY_BUNDLE.ts` file present in that folder, confirming the instructions now match reality.

- [ ] **Step 11: Commit**

```bash
git add public/favicon.svg src/components/emails/ComposeModal.tsx src/components/reports/RevenueOverTime.tsx src/components/emails/CampaignStats.tsx src/components/reports/LeadsReport.tsx supabase/functions/crm-mcp/README.md mcp-server/README.md
git commit -m "fix: recolor leftover indigo brand colors to Signal teal; correct stale crm-mcp deploy docs and Brisk CRM doc refs"
```

- [ ] **Step 12: STOP and report**

Report Task 3 complete with the `tsc -b` output, the hex-grep output (confirming zero matches), and manual-verification results. This is the last task in the plan — report overall completion of the backlog-cleanup plan.

---

## Post-merge: deploy & verify (after all three tasks are merged to `main`)

This frontend deploys via Vercel's GitHub push trigger — no manual Dashboard step involved, **except** `supabase/functions/crm-mcp/README.md` is documentation only (not deployed code) so it needs no redeploy action; `mcp-server/README.md` is also documentation only, for the local-only MCP server.

1. `git push origin main`.
2. Poll `https://api.github.com/repos/FearCleevan/crm-app/commits/<sha>/status` until the Vercel check resolves to `success` — don't assume it from the push alone.
3. Repeat the relevant manual checks from Tasks 1-3 above against the real deployment at `https://crm.peterpaullazan.com`.
