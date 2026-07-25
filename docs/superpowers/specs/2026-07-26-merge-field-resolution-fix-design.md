# Merge-Field Resolution Fix — Design

## Problem

The CRM's email templates support `{{...}}` merge-field placeholders (`{{first_name}}`,
`{{company}}`, etc.). Five places in the codebase independently define or consume the set of
supported tokens, and they've drifted apart:

| Location | Tokens | Gap |
|---|---|---|
| `VariableChips.TEMPLATE_VARIABLES` (chip picker in the template editor) | 7 | missing `full_name` |
| `crm-mcp/tools/templateVariables.ts` (MCP auto-detection) | 7 | missing `full_name` |
| `TemplateModal.resolvePreview` (template editor's fake-data preview) | 7 | missing `full_name` |
| `send-campaign-batch/index.ts`'s `resolveVars` (real resolver for campaign-batch sends) | 8 | none — most complete list |
| `ComposeModal.tsx`'s `resolveVars` (real resolver for **manual Compose sends and scheduled sends**) | 5 | missing `last_name`, `job_title`, `website` |

`send-email/index.ts` and `send-scheduled-emails/index.ts` (the edge functions that actually call
Resend) perform **zero** token resolution themselves — they trust the caller already resolved
everything. For Compose, that caller is `ComposeModal.tsx`; for scheduled sends, resolution also
happens client-side in `ComposeModal.tsx` at schedule time, before the row is written to
`scheduled_emails`.

**Confirmed real-world effect:** a real prospect can receive an email via Compose or a scheduled
send containing the literal, unresolved text `{{last_name}}`, `{{job_title}}`, or `{{website}}` —
no error, no warning by default. `ComposeModal.tsx` has an opt-in "Preview" toggle
(`highlightUnresolved`, a generic `{{[^}]+}}` catch-all that highlights any leftover token in
orange) which would catch this if used, but it's off by default and doesn't block the Send button.

Separately, `useProspectSearch.ts` (which supplies the prospect object `ComposeModal` resolves
against) only selects `id, fullname, firstname, lastname, email, company` — it doesn't fetch
`jobtitle`/`website` at all, so those two tokens have no data to resolve to even before any
resolver-logic fix. Both columns exist on `prospects` (confirmed against `crm-schema.sql`).

## Decision

Centralize the canonical token list and resolution logic **within the frontend only** — a new
module, `src/lib/mergeFields.ts`, becomes the single source of truth for
`VariableChips.tsx`, `TemplateModal.tsx`, and `ComposeModal.tsx` (all same React/TS runtime, so
real code-sharing is possible and appropriate here). Each of these three currently hand-maintains
its own copy of the token list; after this fix, all three derive from one place, so adding a
future merge field means editing one file instead of remembering to update three.

**The two backend edge functions are explicitly NOT touched by this fix**, per this project's
established convention of hand-mirroring logic across the frontend/Supabase-Deno/MCP runtime
boundary rather than sharing code across it (the same pattern already used for
`DEPLOY_BUNDLE.ts` and `authorize-form.ts` elsewhere in this codebase):
- `send-campaign-batch/index.ts` already has the correct 8-token list — no change needed.
- `crm-mcp/tools/templateVariables.ts` stays at 7 tokens, still missing `full_name` — a known,
  accepted residual gap after this fix. MCP-created templates will still not auto-detect
  `{{full_name}}` usage. This is intentionally out of scope here (fixing it would mean touching
  the Deno/MCP side, which this pass deliberately does not).

This fix does **not** touch the separate, already-logged `TemplateModal.tsx` bug where
`variables: []` is hardcoded on every save (project memory: `project_backlog_2026-07-25.md`) —
confirmed during investigation that the `email_templates.variables` column is purely a display
concern (read only by `TemplateCard.tsx`/`TemplateListRow.tsx` for chip badges) and has zero
bearing on the actual send-time resolution this fix addresses. The two bugs are independent.

## Architecture

**New file, `src/lib/mergeFields.ts`** — pure logic, no React/DOM dependencies:

```typescript
export const MERGE_FIELDS = [
  { key: 'first_name',   label: 'First Name'   },
  { key: 'last_name',    label: 'Last Name'    },
  { key: 'full_name',    label: 'Full Name'    },
  { key: 'company',      label: 'Company'      },
  { key: 'job_title',    label: 'Job Title'    },
  { key: 'website',      label: 'Website'      },
  { key: 'my_name',      label: 'My Name'      },
  { key: 'my_portfolio', label: 'My Portfolio' },
] as const

export type MergeFieldKey = typeof MERGE_FIELDS[number]['key']

export function resolveMergeFields(
  text: string,
  values: Partial<Record<MergeFieldKey, string>>,
): string {
  let result = text
  for (const { key } of MERGE_FIELDS) {
    result = result.split(`{{${key}}}`).join(values[key] ?? '')
  }
  return result
}
```

`resolveMergeFields` owns only the mechanical substitution and the canonical list of valid keys.
Each call site owns what *values* to substitute — that's deliberately not centralized, since
"what's the fallback for a missing company" (real send: `'your company'`; fake preview: a sample
value) is a per-context decision, not a fact about the token system itself.

**`VariableChips.tsx`** — its `TEMPLATE_VARIABLES` array (currently a hand-written
`{ label, variable }[]`) becomes a one-line derivation:
```typescript
export const TEMPLATE_VARIABLES = MERGE_FIELDS.map(f => ({ label: f.label, variable: `{{${f.key}}}` }))
```
No change to the component's own rendering/keyboard-navigation logic — only its data source
changes. This automatically adds a `full_name` chip.

**`TemplateModal.tsx`** — its local `resolvePreview(text)` becomes a thin wrapper calling
`resolveMergeFields(text, SAMPLE)`, where the existing `SAMPLE` fixture
(`{ first_name: 'John', company: 'Acme Corp', ... }`) gains a `full_name` entry (e.g.
`'John Smith'`, consistent with the existing `first_name`/`last_name` sample values). Its
`highlightUnresolved` function is untouched — it already just wraps `resolvePreview`'s output and
regex-highlights any leftover `{{...}}`, which continues to work unchanged once `resolvePreview`
covers all 8 tokens.

**`ComposeModal.tsx`** — its local `resolveVars(text, prospect)` becomes a thin wrapper that first
builds a `values` object from the (now-widened) `prospect` param, preserving every existing
fallback exactly:
```typescript
function resolveVars(text: string, prospect: ProspectSuggestion | null): string {
  return resolveMergeFields(text, {
    first_name:   prospect?.firstname ?? '',
    last_name:    prospect?.lastname  ?? '',
    full_name:    prospect?.fullname  ?? '',
    company:      prospect?.company   ?? 'your company',
    job_title:    prospect?.jobtitle  ?? '',
    website:      prospect?.website   ?? '',
    my_name:      'Peter Lazan',
    my_portfolio: 'lazandev.vercel.app',
  })
}
```
This is the change that actually closes the bug: `last_name`, `job_title`, and `website` become
real, working tokens for both manual Compose sends and scheduled sends. `highlightUnresolved` in
this file is likewise untouched — same reasoning as `TemplateModal`'s.

**`useProspectSearch.ts`** — its Supabase `.select(...)` widens from
`'id, fullname, firstname, lastname, email, company'` to additionally include `jobtitle, website`.
Its `ProspectSuggestion` TypeScript interface gains `jobtitle?: string | null` and
`website?: string | null` to match.

## Testing

No frontend test framework exists in this project (matches established convention). But
`resolveMergeFields` is a pure function with zero React/DOM dependencies — the same shape as
`extractTemplateVariables` from the recent MCP-connector work, which got its own small `npx tsx`
verification script rather than a full test framework. This fix follows the identical pattern:
a new `scripts/verify-merge-fields.mjs`, run via `npx tsx`, asserting:
- All 8 tokens resolve correctly when every value is supplied.
- A token with no corresponding value in the `values` map resolves to an empty string (matches
  the `?? ''` fallback pattern used at each call site).
- An unrecognized token, e.g. `{{foo}}`, is left completely untouched in the output (proving the
  function only ever touches the 8 known keys, never does a generic `{{...}}` sweep).
- A body containing all 8 tokens in a scrambled order all resolve correctly in one pass (proving
  the loop-based substitution doesn't have an ordering bug, e.g. one token's replacement value
  accidentally containing another token's literal `{{...}}` text — not expected with the current
  fixed sample/fallback values, but worth asserting since it's cheap to check).

Beyond the automated script, this needs the same category of manual verification as prior UI
changes in this project (no way to assert "the Compose modal actually sends a correct email"
without a human): open the running app, use Compose with a template containing all 8 tokens
against a real prospect that has `jobtitle`/`website` populated, toggle Preview, and confirm no
token shows highlighted as unresolved.

## Out of scope

- `crm-mcp/tools/templateVariables.ts` and any other Supabase/Deno-side file — cross-runtime
  centralization is deliberately not attempted, per this project's established convention.
- The separate `TemplateModal.tsx` `variables: []` bug (already logged in project memory as an
  independent, lower-priority issue — confirmed unrelated to send-time resolution).
- Any change to `highlightUnresolved` in either `TemplateModal.tsx` or `ComposeModal.tsx` — both
  already work correctly once the underlying resolver covers all 8 tokens, no changes needed.
- Any change to `my_name`/`my_portfolio` being hardcoded literals rather than coming from a user
  profile/settings — pre-existing behavior, unrelated to the drift bug this fix addresses.
