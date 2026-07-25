# Merge-Field Resolution Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real bug where `ComposeModal.tsx` could send a real prospect an email containing literal, unresolved `{{last_name}}`/`{{job_title}}`/`{{website}}` text, by centralizing merge-field token resolution into one shared frontend module instead of three independently-drifting copies.

**Architecture:** A new pure-logic module, `src/lib/mergeFields.ts`, becomes the single source of truth for the 8 supported merge-field tokens and how substitution works. `VariableChips.tsx`, `TemplateModal.tsx`, and `ComposeModal.tsx` each stop hand-maintaining their own token list/resolver and import from here instead.

**Tech Stack:** Plain TypeScript (no new dependency), React (existing components), `npx tsx` for the one new verification script (already used elsewhere in this project for the same purpose).

## Global Constraints

- `src/lib/mergeFields.ts` is the only new file. It has zero React/DOM dependencies — pure functions and constants only.
- The 8 canonical tokens, in this exact order: `first_name`, `last_name`, `full_name`, `company`, `job_title`, `website`, `my_name`, `my_portfolio`.
- `resolveMergeFields(text, values)` only ever substitutes these 8 keys — an unrecognized token like `{{foo}}` must be left completely untouched in the output.
- Each call site keeps its own default/fallback values (`company` → `'your company'` in `ComposeModal`, sample fixture data in `TemplateModal`) — the shared module does not hardcode any fallback itself, it only does `values[key] ?? ''`.
- **Not touched by this plan** (per the approved spec): `supabase/functions/send-campaign-batch/index.ts` (already has the correct 8-token list) and `supabase/functions/crm-mcp/tools/templateVariables.ts` (stays at 7 tokens, still missing `full_name` — a known, accepted residual gap, cross-runtime, out of scope here).
- **Not touched by this plan**: the separate `TemplateModal.tsx` bug where `variables: []` is hardcoded on save (logged separately in project memory) — confirmed unrelated, since the `email_templates.variables` column has zero bearing on send-time resolution.
- No frontend test framework exists in this project — verification is `npx tsc -b` plus a `npx tsx`-run verification script (same convention as the existing `scripts/verify-middleware.mjs`) plus a manual check.

---

### Task 1: `src/lib/mergeFields.ts` — the shared resolver

**Files:**

- Create: `src/lib/mergeFields.ts`
- Create: `scripts/verify-merge-fields.mjs`

**Interfaces:**

- Produces: `MERGE_FIELDS: readonly { key: MergeFieldKey; label: string }[]` (8 entries, in the fixed order from Global Constraints), `MergeFieldKey` (the union type of the 8 key strings), and `resolveMergeFields(text: string, values: Partial<Record<MergeFieldKey, string>>): string`.
- Consumes: nothing — this task is fully self-contained.

- [ ] **Step 1: Write the failing test script**

Create `scripts/verify-merge-fields.mjs` (at the `crm-app` project root, alongside the existing `scripts/verify-middleware.mjs`):

```javascript
import { resolveMergeFields } from '../src/lib/mergeFields.ts'

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
  console.log(`OK: ${label}`)
}

assertEqual(
  resolveMergeFields(
    'Hi {{first_name}} {{last_name}} ({{full_name}}) at {{company}}, {{job_title}}, {{website}} — {{my_name}} / {{my_portfolio}}',
    {
      first_name: 'John', last_name: 'Smith', full_name: 'John Smith',
      company: 'Acme Corp', job_title: 'CEO', website: 'acme.com',
      my_name: 'Peter Lazan', my_portfolio: 'lazandev.vercel.app',
    },
  ),
  'Hi John Smith (John Smith) at Acme Corp, CEO, acme.com — Peter Lazan / lazandev.vercel.app',
  'all 8 tokens resolve when every value is supplied',
)

assertEqual(
  resolveMergeFields('Hi {{first_name}}, welcome to {{company}}.', {}),
  'Hi , welcome to .',
  'missing values resolve to empty string',
)

assertEqual(
  resolveMergeFields('Hi {{foo}}, {{first_name}}!', { first_name: 'Jane' }),
  'Hi {{foo}}, Jane!',
  'unrecognized token is left untouched',
)

assertEqual(
  resolveMergeFields(
    '{{my_portfolio}} {{my_name}} {{website}} {{job_title}} {{company}} {{full_name}} {{last_name}} {{first_name}}',
    {
      first_name: 'A', last_name: 'B', full_name: 'C', company: 'D',
      job_title: 'E', website: 'F', my_name: 'G', my_portfolio: 'H',
    },
  ),
  'H G F E D C B A',
  'all 8 tokens in scrambled order all resolve in one pass',
)

console.log('ALL CHECKS PASSED')
```

- [ ] **Step 2: Run the script and confirm it fails**

Run (from `crm-app/`): `npx tsx scripts/verify-merge-fields.mjs`
Expected: fails immediately with a module-resolution error for `../src/lib/mergeFields.ts` (the file doesn't exist yet). This confirms the test actually exercises the not-yet-written function.

- [ ] **Step 3: Create `src/lib/mergeFields.ts`**

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

- [ ] **Step 4: Type-check**

Run (from `crm-app/`): `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 5: Run the script and confirm it passes**

Run (from `crm-app/`): `npx tsx scripts/verify-merge-fields.mjs`
Expected: four `OK:` lines followed by `ALL CHECKS PASSED`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mergeFields.ts scripts/verify-merge-fields.mjs
git commit -m "feat: add shared resolveMergeFields module"
```

---

### Task 2: wire the 4 consumers to the shared module

**Files:**

- Modify: `src/components/emails/VariableChips.tsx`
- Modify: `src/hooks/useProspectSearch.ts`
- Modify: `src/components/emails/TemplateModal.tsx`
- Modify: `src/components/emails/ComposeModal.tsx`

**Interfaces:**

- Consumes: `MERGE_FIELDS` and `resolveMergeFields` from Task 1's `src/lib/mergeFields.ts` (exact names and signature as defined there).
- Produces: nothing new for later tasks — this is the last task in this plan.

- [ ] **Step 1: `VariableChips.tsx` — derive the chip list from `MERGE_FIELDS`**

Replace:

```typescript
import { useRef } from 'react'
import { Plus } from 'lucide-react'

export const TEMPLATE_VARIABLES = [
  { label: 'First Name',    variable: '{{first_name}}'   },
  { label: 'Last Name',     variable: '{{last_name}}'    },
  { label: 'Company',       variable: '{{company}}'      },
  { label: 'Job Title',     variable: '{{job_title}}'    },
  { label: 'Website',       variable: '{{website}}'      },
  { label: 'My Name',       variable: '{{my_name}}'      },
  { label: 'My Portfolio',  variable: '{{my_portfolio}}' },
]
```

with:

```typescript
import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { MERGE_FIELDS } from '@/lib/mergeFields'

export const TEMPLATE_VARIABLES = MERGE_FIELDS.map(f => ({ label: f.label, variable: `{{${f.key}}}` }))
```

Nothing else in this file changes — the component's rendering and keyboard-navigation code already just reads `TEMPLATE_VARIABLES` generically.

- [ ] **Step 2: `useProspectSearch.ts` — widen the type and the query**

Replace:

```typescript
export interface ProspectSuggestion {
  id: number
  fullname: string | null
  firstname: string | null
  lastname: string | null
  email: string | null
  company: string | null
}
```

with:

```typescript
export interface ProspectSuggestion {
  id: number
  fullname: string | null
  firstname: string | null
  lastname: string | null
  email: string | null
  company: string | null
  jobtitle: string | null
  website: string | null
}
```

Replace:

```typescript
        .select('id, fullname, firstname, lastname, email, company')
```

with:

```typescript
        .select('id, fullname, firstname, lastname, email, company, jobtitle, website')
```

- [ ] **Step 3: `TemplateModal.tsx` — use the shared resolver for the preview**

Replace:

```typescript
import { X } from 'lucide-react'
import { VariableChips } from './VariableChips'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'
import type { RichTemplateDB } from '@/types/campaigns'

const SAMPLE = { first_name: 'John', company: 'Acme Corp', job_title: 'CEO', website: 'acmecorp.com', last_name: 'Smith', my_name: 'Peter Lazan', my_portfolio: 'lazandev.vercel.app' }

function resolvePreview(text: string): string {
  return text
    .replace(/{{first_name}}/g, SAMPLE.first_name)
    .replace(/{{last_name}}/g,  SAMPLE.last_name)
    .replace(/{{company}}/g,    SAMPLE.company)
    .replace(/{{job_title}}/g,  SAMPLE.job_title)
    .replace(/{{website}}/g,    SAMPLE.website)
    .replace(/{{my_name}}/g,    SAMPLE.my_name)
    .replace(/{{my_portfolio}}/g, SAMPLE.my_portfolio)
}
```

with:

```typescript
import { X } from 'lucide-react'
import { VariableChips } from './VariableChips'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'
import type { RichTemplateDB } from '@/types/campaigns'
import { resolveMergeFields } from '@/lib/mergeFields'

const SAMPLE = {
  first_name: 'John', last_name: 'Smith', full_name: 'John Smith',
  company: 'Acme Corp', job_title: 'CEO', website: 'acmecorp.com',
  my_name: 'Peter Lazan', my_portfolio: 'lazandev.vercel.app',
}

function resolvePreview(text: string): string {
  return resolveMergeFields(text, SAMPLE)
}
```

Do not touch `highlightUnresolved` in this file — it already just wraps `resolvePreview`'s output in a regex highlight and needs no change; it will correctly stop flagging `{{full_name}}` as unresolved now that `resolvePreview` covers it.

- [ ] **Step 4: `ComposeModal.tsx` — the actual bug fix (three separate edits in this file)**

**4a.** Replace the import block and `resolveVars` function:

```typescript
import { useProspectSearch, type ProspectSuggestion } from '@/hooks/useProspectSearch'
import { emailService } from '@/services/email.service'
import { useAuth } from '@/context/AuthContext'
import { EmailEditor } from './EmailEditor'
import type { RichTemplateDB } from '@/types/campaigns'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Variable resolver ─────────────────────────────────────────
function resolveVars(text: string, prospect: { firstname?: string | null; fullname?: string | null; company?: string | null } | null): string {
  if (!text) return text
  return text
    .replace(/{{first_name}}/g,   prospect?.firstname   ?? '')
    .replace(/{{full_name}}/g,    prospect?.fullname    ?? '')
    .replace(/{{company}}/g,      prospect?.company     ?? 'your company')
    .replace(/{{my_name}}/g,      'Peter Lazan')
    .replace(/{{my_portfolio}}/g, 'lazandev.vercel.app')
}
```

with:

```typescript
import { useProspectSearch, type ProspectSuggestion } from '@/hooks/useProspectSearch'
import { emailService } from '@/services/email.service'
import { useAuth } from '@/context/AuthContext'
import { EmailEditor } from './EmailEditor'
import type { RichTemplateDB } from '@/types/campaigns'
import { resolveMergeFields } from '@/lib/mergeFields'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Variable resolver ─────────────────────────────────────────
function resolveVars(text: string, prospect: {
  firstname?: string | null
  lastname?: string | null
  fullname?: string | null
  company?: string | null
  jobtitle?: string | null
  website?: string | null
} | null): string {
  if (!text) return text
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

**4b.** This is the critical, easy-to-miss part — `linkedProspect`'s own state type is narrower than `resolveVars`'s new parameter type and must be widened too, or `lastname`/`jobtitle`/`website` will still never reach the resolver even though `resolveVars` itself now supports them. Replace:

```typescript
  const [linkedProspect,   setLinkedProspect]   = useState<{ fullname: string; email: string; firstname?: string; company?: string } | null>(null)
```

with:

```typescript
  const [linkedProspect,   setLinkedProspect]   = useState<{
    fullname: string
    email: string
    firstname?: string
    lastname?: string
    company?: string
    jobtitle?: string
    website?: string
  } | null>(null)
```

**4c.** `handleProspectPick` builds the `linked` object that gets stored in `linkedProspect` — it currently only copies `fullname`/`email`/`firstname`/`company` off the picked `ProspectSuggestion`, silently dropping `lastname` even today (and `jobtitle`/`website` don't exist on `ProspectSuggestion` yet before Task 2 Step 2, which this task depends on). Replace:

```typescript
  function handleProspectPick(prospect: ProspectSuggestion) {
    const linked = { fullname: prospect.fullname ?? '', email: prospect.email ?? '', firstname: prospect.firstname ?? undefined, company: prospect.company ?? undefined }
```

with:

```typescript
  function handleProspectPick(prospect: ProspectSuggestion) {
    const linked = {
      fullname:  prospect.fullname  ?? '',
      email:     prospect.email     ?? '',
      firstname: prospect.firstname ?? undefined,
      lastname:  prospect.lastname  ?? undefined,
      company:   prospect.company   ?? undefined,
      jobtitle:  prospect.jobtitle  ?? undefined,
      website:   prospect.website   ?? undefined,
    }
```

Nothing else in `handleProspectPick`, `handleTemplateSelect`, or the `previewHtml` line changes — they all already call `resolveVars(..., linkedProspect)` and will pick up the wider data automatically once 4a-4c land together.

- [ ] **Step 5: Type-check**

Run (from `crm-app/`): `npx tsc -b`
Expected: no output, exit code 0. If this fails, the most likely cause is a mismatch between `resolveVars`'s new parameter type (Step 4a) and `linkedProspect`'s state type (Step 4b) — both must have compatible optional fields for `lastname`/`jobtitle`/`website`.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open the printed local URL, log in.

1. Go to a prospect record that has both a Job Title and a Website populated (or add one via Prospects → edit), confirming that data exists to resolve against.
2. Open Emails → Compose. Select a template (or type a new one) whose body contains all 8 tokens: `{{first_name}} {{last_name}} {{full_name}} {{company}} {{job_title}} {{website}} {{my_name}} {{my_portfolio}}`.
3. Use the prospect-linker to link the Compose modal to that prospect.
4. Click the "Preview" toggle (the eye icon).
5. Confirm: none of the 8 tokens show highlighted in orange as unresolved — all should show as real resolved values.
6. Separately, open Emails → Templates → New Template, confirm the variable-chip row now shows an 8th "Full Name" chip alongside the existing 7, and that clicking it inserts `{{full_name}}` into the body.

- [ ] **Step 7: Commit**

```bash
git add src/components/emails/VariableChips.tsx src/hooks/useProspectSearch.ts src/components/emails/TemplateModal.tsx src/components/emails/ComposeModal.tsx
git commit -m "fix: resolve last_name/job_title/website in Compose and scheduled sends"
```

---

## Post-merge: deploy & verify (after this is merged to `main`)

This frontend deploys via Vercel's GitHub push trigger — no manual Dashboard step involved.

1. `git push origin main`.
2. Poll `https://api.github.com/repos/FearCleevan/crm-app/commits/<sha>/status` until the Vercel
   check resolves to `success` — don't assume it from the push alone.
3. Repeat the Step 6 manual check above against the real deployment at
   `https://crm.peterpaullazan.com`.
