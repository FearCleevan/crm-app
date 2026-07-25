# crm-mcp Email Template Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Claude (via the claude.ai `crm-mcp` connector) create and list email templates in the CRM, closing the gap where campaigns can reference a template by id but nothing lets Claude write one.

**Architecture:** Two new tools (`create_email_template`, `list_email_templates`) added to `crm-mcp/tools/campaigns.ts`'s existing `campaignTools` array, mirrored into the single-file `DEPLOY_BUNDLE.ts`. Merge-field detection (`{{first_name}}` etc.) is a pure function factored into its own file so it's unit-testable without a live Supabase call.

**Tech Stack:** Supabase Edge Function (Deno/TypeScript), zod schemas, existing `email_templates` table (no schema change).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-crm-mcp-email-template-tools-design.md` — approved, do not deviate from its Decision/Tool sections.
- **v2 (`crm-mcp`) only.** The local Claude Code MCP server (`mcp-server/`) is explicitly out of scope for this plan.
- Scope is create + list only — no get/update/delete tool.
- `variables` is always computed server-side from `body` via `extractTemplateVariables` — never accepted as a tool argument.
- `create_email_template` has **no** `confirm` guard (matches `create_campaign`/`create_prospect`/`create_deal`).
- `list_email_templates` filters `is_active = true` only — **not** filtered by `created_by` (differs from the frontend's own `templateService.getTemplates`, matches `list_campaigns`/`list_deals`/`list_notes` in the same file).
- The 7 recognized merge-field tokens, in this exact fixed order (source of truth: `src/components/emails/VariableChips.tsx`'s `TEMPLATE_VARIABLES`): `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{job_title}}`, `{{website}}`, `{{my_name}}`, `{{my_portfolio}}`. An unrecognized `{{foo}}` is never added to `variables`.
- The `category` enum (matches the DB check constraint in `crm-schema.sql`, extended by migration `004_extend_email_templates.sql`): `general`, `follow_up`, `introduction`, `proposal`, `closing`, `re_engagement`, `newsletter`, `cold_outreach`, `no_website`, `outdated_website` — default `general`.
- Any Supabase deploy step must go through the Dashboard (paste-and-deploy via `DEPLOY_BUNDLE.ts`) — no `supabase functions deploy` CLI instructions, per this project's standing convention.
- Worktree convention: implement on a new branch off `main` in a worktree at `crm-app/.worktrees/crm-mcp-email-templates`, created via `superpowers:using-git-worktrees` at execution time. Do **not** use `isolation: "worktree"` on the Agent tool for task dispatch — that caused a real incident on a prior plan (committed straight to `main` instead of the branch). Dispatch subagents with an instruction to `cd` into the existing worktree path instead.

---

### Task 1: `extractTemplateVariables` pure function

**Files:**

- Create: `supabase/functions/crm-mcp/tools/templateVariables.ts`
- Create: `supabase/functions/crm-mcp/scripts/verify-template-variables.mjs`

**Interfaces:**

- Produces: `templateVariables.ts` exports `TEMPLATE_VARIABLE_TOKENS: string[]` (the 7 fixed tokens, in the fixed order from Global Constraints) and `extractTemplateVariables(body: string): string[]` — filters `TEMPLATE_VARIABLE_TOKENS` down to whichever tokens appear as an exact substring of `body`, in `TEMPLATE_VARIABLE_TOKENS`'s own order (not body order).
- Consumes: nothing from other tasks — this file has zero external imports, deliberately, so it can be loaded directly by both Deno (Task 2) and a plain Node `tsx` script (this task) without hitting any Deno-only global.

- [ ] **Step 1: Write the failing test script**

Create `supabase/functions/crm-mcp/scripts/verify-template-variables.mjs`:

```javascript
import { extractTemplateVariables } from '../tools/templateVariables.ts'

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`)
  console.log(`OK: ${label}`)
}

assertEqual(
  extractTemplateVariables('Hi {{first_name}}, following up from {{company}}.'),
  ['{{first_name}}', '{{company}}'],
  'known tokens extracted in fixed order',
)

assertEqual(
  extractTemplateVariables('Hi there, just checking in.'),
  [],
  'no known tokens present',
)

assertEqual(
  extractTemplateVariables('Hi {{foo}}, unrecognized token stays literal.'),
  [],
  'unrecognized {{foo}} is not included',
)

assertEqual(
  extractTemplateVariables(
    '{{my_portfolio}} {{my_name}} {{website}} {{job_title}} {{company}} {{last_name}} {{first_name}}',
  ),
  [
    '{{first_name}}', '{{last_name}}', '{{company}}',
    '{{job_title}}', '{{website}}', '{{my_name}}', '{{my_portfolio}}',
  ],
  'all 7 tokens in reverse body-order returned in fixed list order',
)

console.log('ALL CHECKS PASSED')
```

- [ ] **Step 2: Run the script and confirm it fails**

Run (from `supabase/functions/crm-mcp/`): `npx tsx scripts/verify-template-variables.mjs`
Expected: fails immediately with a module-resolution error for `../tools/templateVariables.ts` (the file doesn't exist yet). This confirms the test actually exercises the not-yet-written function.

- [ ] **Step 3: Create `templateVariables.ts`**

Create `supabase/functions/crm-mcp/tools/templateVariables.ts`:

```typescript
export const TEMPLATE_VARIABLE_TOKENS = [
  '{{first_name}}',
  '{{last_name}}',
  '{{company}}',
  '{{job_title}}',
  '{{website}}',
  '{{my_name}}',
  '{{my_portfolio}}',
]

export function extractTemplateVariables(body: string): string[] {
  return TEMPLATE_VARIABLE_TOKENS.filter((token) => body.includes(token))
}
```

- [ ] **Step 4: Type-check**

Run (from `supabase/functions/crm-mcp/`): `npx deno check tools/templateVariables.ts`
Expected: `Check tools/templateVariables.ts`, no errors.

- [ ] **Step 5: Run the script and confirm it passes**

Run (from `supabase/functions/crm-mcp/`): `npx tsx scripts/verify-template-variables.mjs`
Expected: four `OK:` lines followed by `ALL CHECKS PASSED`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/crm-mcp/tools/templateVariables.ts supabase/functions/crm-mcp/scripts/verify-template-variables.mjs
git commit -m "feat: add extractTemplateVariables for email template merge-field detection"
```

---

### Task 2: `create_email_template` / `list_email_templates` tools

**Files:**

- Modify: `supabase/functions/crm-mcp/tools/campaigns.ts`
- Modify: `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts`
- Modify: `supabase/functions/crm-mcp/scripts/verify-http.mjs`

**Interfaces:**

- Consumes: `extractTemplateVariables(body: string): string[]` from Task 1's `templateVariables.ts` (imported in `campaigns.ts`; inlined as an identical copy in `DEPLOY_BUNDLE.ts`, since that file is a single-file bundle with no imports of its own modules).
- Produces: two new entries in the `campaignTools: ToolDef[]` array (same `ToolDef` shape as every existing tool: `name`, `description`, `schema: Record<string, z.ZodTypeAny>`, `handler`), which `tools/registry.ts` already spreads into the combined `TOOLS` array with no changes needed there.

- [ ] **Step 1: Update the failing assertions in `verify-http.mjs`**

Open `supabase/functions/crm-mcp/scripts/verify-http.mjs`.

**1a.** Replace:

```javascript
  console.log('=== tools/list (expect 13 tools: 4 prospect + 4 deal + 5 campaign) ===')
  const list4 = await rpc('tools/list', {}, 7)
  const names3 = list4.body.result.tools.map((t) => t.name)
  console.log(names3)
  for (const expected of [
    'list_campaigns', 'get_campaign', 'create_campaign', 'activate_campaign', 'list_campaign_recipients',
  ]) {
    if (!names3.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }
```

with:

```javascript
  console.log('=== tools/list (expect 15 tools: 4 prospect + 4 deal + 5 campaign + 2 template) ===')
  const list4 = await rpc('tools/list', {}, 7)
  const names3 = list4.body.result.tools.map((t) => t.name)
  console.log(names3)
  for (const expected of [
    'list_campaigns', 'get_campaign', 'create_campaign', 'activate_campaign', 'list_campaign_recipients',
    'create_email_template', 'list_email_templates',
  ]) {
    if (!names3.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }
```

**1b.** Immediately after the existing `activate_campaign WITHOUT confirm` block — i.e. right after this closing brace (leave it exactly as-is, this is just the anchor):

```javascript
  if (JSON.stringify(noConfirm.body).includes('"status":"active"')) {
    throw new Error('activate_campaign without confirm appears to have activated something')
  }
```

insert these two new blocks (before the blank line + `console.log('=== tools/list (expect 15 tools: ... + 2 note) ===')` block that currently follows):

```javascript

  console.log('=== tools/call: create_email_template (expect isError, placeholder credentials) ===')
  const templateCall = await rpc(
    'tools/call',
    {
      name: 'create_email_template',
      arguments: {
        name: 'Cold Outreach Intro',
        subject: 'Quick question, {{first_name}}',
        body: 'Hi {{first_name}}, I noticed {{company}} might benefit from...',
      },
    },
    17,
  )
  console.log(JSON.stringify(templateCall.body, null, 2))
  if (templateCall.body?.result?.isError !== true) {
    throw new Error('expected isError:true from create_email_template')
  }

  console.log('=== tools/call: list_email_templates (expect isError, placeholder credentials) ===')
  const templatesListCall = await rpc('tools/call', { name: 'list_email_templates', arguments: {} }, 18)
  console.log(JSON.stringify(templatesListCall.body, null, 2))
  if (templatesListCall.body?.result?.isError !== true) {
    throw new Error('expected isError:true from list_email_templates')
  }
```

(The note/workflow/report/outreach checkpoints below this point are presence-checks only, not length assertions — e.g. `for (const expected of ['list_notes', 'add_note']) if (!names4.includes(expected)) throw ...` — so none of them need any change.)

**1c.** Replace the one place in the file that DOES assert an exact tool count:

```javascript
  console.log('tools/list via OAuth-issued token, count:', finalNames.length)
  if (finalNames.length !== 19) throw new Error(`expected 19 tools, got ${finalNames.length}`)
```

with:

```javascript
  console.log('tools/list via OAuth-issued token, count:', finalNames.length)
  if (finalNames.length !== 21) throw new Error(`expected 21 tools, got ${finalNames.length}`)
```

- [ ] **Step 2: Run the harness and confirm it fails**

Run: `cd supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: fails at `missing tool: create_email_template` (the campaign checkpoint's presence check) — today, `campaignTools` has no such tool.

- [ ] **Step 3: Add the two tools to `campaigns.ts`**

In `supabase/functions/crm-mcp/tools/campaigns.ts`, add this import alongside the existing ones at the top of the file:

```typescript
import { extractTemplateVariables } from './templateVariables.ts'
```

Then add these two entries to the end of the `campaignTools` array, after the existing `list_campaign_recipients` entry (i.e. immediately before the array's closing `]`):

```typescript
  {
    name: 'create_email_template',
    description:
      'Create a reusable email template. Merge-field placeholders like {{first_name}} and {{company}} in the body are detected automatically.',
    schema: {
      name: z.string().min(1),
      category: z.enum([
        'general', 'follow_up', 'introduction', 'proposal', 'closing',
        're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
      ]).default('general'),
      subject: z.string().min(1),
      body: z.string().min(1),
    },
    handler: async ({ name, category, subject, body }) => {
      if (!MCP_CRM_USER_ID) {
        return errorResult(
          'MCP_CRM_USER_ID is not set in Supabase Edge Function Secrets — set it to a real crm_users.id before creating templates.',
        )
      }
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          name,
          category,
          subject,
          body,
          created_by: MCP_CRM_USER_ID,
          is_active: true,
          variables: extractTemplateVariables(body),
        })
        .select('id, name, category, subject, variables, created_at')
        .single()
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
  {
    name: 'list_email_templates',
    description: 'List active email templates, optionally filtered by category',
    schema: {
      category: z.enum([
        'general', 'follow_up', 'introduction', 'proposal', 'closing',
        're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
      ]).optional(),
    },
    handler: async ({ category }) => {
      let q = supabase
        .from('email_templates')
        .select('id, name, category, subject, variables, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (category) q = q.eq('category', category)
      const { data, error } = await q
      if (error) return errorResult(error.message)
      return jsonResult(data)
    },
  },
```

- [ ] **Step 4: Type-check**

Run (from `supabase/functions/crm-mcp/`): `npx deno check oauth.ts index.ts`
Expected: two `Check` lines, no errors. (`index.ts` transitively imports `registry.ts` → `campaigns.ts` → `templateVariables.ts`, so this covers the whole new graph.)

- [ ] **Step 5: Run the harness and confirm it passes**

Run: `cd supabase/functions/crm-mcp && node scripts/verify-http.mjs`
Expected: `ALL CHECKS PASSED` at the end. The later OAuth full-loop check must still report count 21 and pass unmodified otherwise.

- [ ] **Step 6: Mirror the same change into `DEPLOY_BUNDLE.ts`**

`DEPLOY_BUNDLE.ts` is a single-file bundle with no imports of this project's own modules, so `extractTemplateVariables` must be inlined here rather than imported. In `supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts`, add this block immediately before the `// ── Campaign tools ─────────────────────────────────────────────` section comment (i.e. right after wherever the prior section, `dealTools`, ends):

```typescript
// ── Email template merge-field detection ────────────────────────
const TEMPLATE_VARIABLE_TOKENS = [
  '{{first_name}}',
  '{{last_name}}',
  '{{company}}',
  '{{job_title}}',
  '{{website}}',
  '{{my_name}}',
  '{{my_portfolio}}',
]

function extractTemplateVariables(body: string): string[] {
  return TEMPLATE_VARIABLE_TOKENS.filter((token) => body.includes(token))
}

```

Then add the identical two tool entries from Step 3 (`create_email_template`, `list_email_templates` — same code, `extractTemplateVariables` now resolving to the local function just added instead of an import) to the end of `DEPLOY_BUNDLE.ts`'s own `campaignTools` array, in the same position (after `list_campaign_recipients`, before the array's closing `]`).

- [ ] **Step 7: Type-check the bundle**

Run (from `supabase/functions/crm-mcp/`): `npx deno check DEPLOY_BUNDLE.ts`
Expected: `Check DEPLOY_BUNDLE.ts`, no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/crm-mcp/tools/campaigns.ts supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts supabase/functions/crm-mcp/scripts/verify-http.mjs
git commit -m "feat: add create_email_template and list_email_templates MCP tools"
```

---

## Post-merge: manual deploy & verify (user, after merge to `main`)

1. **Supabase Dashboard** → Edge Functions → `crm-mcp` → paste the updated `DEPLOY_BUNDLE.ts` contents as `index.ts` → Deploy. No secret changes needed — this reuses the existing `MCP_CRM_USER_ID` and `CRM_MCP_TOKEN` secrets already configured.
2. In claude.ai, ask Claude to create a new email template (e.g. "save a cold-outreach template that mentions {{first_name}} and {{company}}") and confirm it responds with a created template id/name.
3. Ask Claude to list templates and confirm the one just created appears.
4. Open the CRM's own Emails → Templates UI and confirm the new template shows up there too, with the merge-field chips correctly reflecting what was auto-detected (not an empty variables list, and not including any unrecognized placeholder).
5. Optionally: ask Claude to create a campaign using the new template's id (via the existing `create_campaign` tool) to confirm the two features compose correctly end to end.
