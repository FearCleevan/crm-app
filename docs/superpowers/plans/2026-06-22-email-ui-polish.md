# Email UI Polish — Real Data & Layout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all remaining mock data in the Email module with live Supabase queries, fix the broken list view in TemplateManager, and enable the pg_cron batch email schedule.

**Architecture:** ComposeModal's prospect search is replaced by a lightweight debounced `useProspectSearch` hook that queries Supabase directly (no full pagination needed — just top-6 matches). TemplateManager's broken list view (renders a full card inside a row) is replaced with a new `TemplateListRow` component. pg_cron is a one-time SQL step in the Supabase Dashboard.

**Tech Stack:** React 18, TypeScript, Supabase JS v2, Tailwind CSS v3, Vite

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useProspectSearch.ts` | **Create** — debounced Supabase prospect search returning top 6 matches |
| `src/components/emails/ComposeModal.tsx` | **Modify** — replace all 6 `MOCK_PROSPECTS` references with the new hook and `ProspectRow` type |
| `src/components/emails/TemplateListRow.tsx` | **Create** — compact single-row template display for list view mode |
| `src/components/emails/TemplateManager.tsx` | **Modify** — use `TemplateListRow` in list view instead of `TemplateCard` |

---

## Task 1: useProspectSearch hook

**Files:**
- Create: `src/hooks/useProspectSearch.ts`

**Context:** `ProspectRow` is defined in `src/types/database.ts`. The `supabase` client is at `src/lib/supabase`. We only need `id, fullname, firstname, lastname, email, company` for the compose suggestions — no full pagination.

- [ ] **Step 1: Create the hook file**

```typescript
// src/hooks/useProspectSearch.ts
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProspectSuggestion {
  id: number
  fullname: string | null
  firstname: string | null
  lastname: string | null
  email: string | null
  company: string | null
}

export function useProspectSearch(query: string, minChars = 2) {
  const [results,  setResults]  = useState<ProspectSuggestion[]>([])
  const [loading,  setLoading]  = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < minChars) {
      setResults([])
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('prospects')
        .select('id, fullname, firstname, lastname, email, company')
        .or(`fullname.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
        .eq('isactive', true)
        .not('email', 'is', null)
        .limit(6)

      setResults((data as ProspectSuggestion[]) ?? [])
      setLoading(false)
    }, 220)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, minChars])

  function clear() { setResults([]) }

  return { results, loading, clear }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProspectSearch.ts
git commit -m "feat: useProspectSearch hook — debounced Supabase prospect lookup"
```

---

## Task 2: Wire ComposeModal to real prospect search

**Files:**
- Modify: `src/components/emails/ComposeModal.tsx`

**Context:** `MOCK_PROSPECTS` is imported from `@/constants/mockData`. It is used in 6 places:
1. Line 6: `import { MOCK_PROSPECTS } from '@/constants/mockData'`
2. Line 33: `suggestions?: typeof MOCK_PROSPECTS` (EmailChipInput prop type)
3. Line 170: `const [suggestions, setSuggestions] = useState<typeof MOCK_PROSPECTS>([])`
4. Line 181: `const [prospectResults, setProspectResults] = useState<typeof MOCK_PROSPECTS>([])`
5. Line 198–201: `MOCK_PROSPECTS.filter(...)` — To field suggestions
6. Line 243–248: `MOCK_PROSPECTS.filter(...)` — Prospect linker search
7. Line 254: `function handleProspectPick(prospect: typeof MOCK_PROSPECTS[0])` — Pick handler

Replace all with `ProspectSuggestion` from the new hook.

- [ ] **Step 1: Replace the MOCK_PROSPECTS import and add hook import**

Find:
```typescript
import { MOCK_PROSPECTS } from '@/constants/mockData'
```

Replace with:
```typescript
import { useProspectSearch, type ProspectSuggestion } from '@/hooks/useProspectSearch'
```

- [ ] **Step 2: Update EmailChipInput prop type**

Find:
```typescript
  suggestions?: typeof MOCK_PROSPECTS
  onSuggestionPick?: (email: string) => void
  onInput?: (val: string) => void
```

Replace with:
```typescript
  suggestions?: ProspectSuggestion[]
  onSuggestionPick?: (email: string) => void
  onInput?: (val: string) => void
```

- [ ] **Step 3: Replace the two state declarations**

Find:
```typescript
  const [suggestions,      setSuggestions]      = useState<typeof MOCK_PROSPECTS>([])
```
Replace with:
```typescript
  const [toSearchQuery,    setToSearchQuery]    = useStatme('')
```

Find:
```typescript
  const [prospectResults,  setProspectResults]  = useState<typeof MOCK_PROSPECTS>([])
```
Replace with:
```typescript  
  const [prospectQuery,    setProspectQuery]    = useState('')
```

- [ ] **Step 4: Add the two search hooks (inside ComposeModal function, after state declarations)**

Add after `const [prospectQuery, setProspectQuery] = useState('')`:
```typescript
  const { results: suggestions,      clear: clearToSuggestions }  = useProspectSearch(toSearchQuery)
  const { results: prospectResults,  clear: clearProspectResults } = useProspectSearch(prospectQuery)
```

- [ ] **Step 5: Update handleToRawInput**

Find:
```typescript
  function handleToRawInput(val: string) {
    setSuggestions(val.length >= 2
      ? MOCK_PROSPECTS.filter(p =>
          p.fullname.toLowerCase().includes(val.toLowerCase()) ||
          p.email.toLowerCase().includes(val.toLowerCase())
        ).slice(0, 5)
      : []
    )
  }
```

Replace with:
```typescript
  function handleToRawInput(val: string) {
    setToSearchQuery(val)
  }
```

- [ ] **Step 6: Update handleSuggestionPick**

Find:
```typescript
  function handleSuggestionPick(email: string) {
    if (!toChips.includes(email)) setToChips(prev => [...prev, email])
    setSuggestions([])
  }
```

Replace with:
```typescript
  function handleSuggestionPick(email: string) {
    if (email && !toChips.includes(email)) setToChips(prev => [...prev, email])
    setToSearchQuery('')
    clearToSuggestions()
  }
```

- [ ] **Step 7: Update handleProspectSearch**

Find:
```typescript
  function handleProspectSearch(val: string) {
    setProspectSearch(val)
    if (val.length >= 2) {
      setProspectResults(
        MOCK_PROSPECTS.filter(p =>
          p.fullname.toLowerCase().includes(val.toLowerCase()) ||
          p.email.toLowerCase().includes(val.toLowerCase()) ||
          p.company.toLowerCase().includes(val.toLowerCase())
        ).slice(0, 6)
      )
    } else {
      setProspectResults([])
    }
  }
```

Replace with:
```typescript
  function handleProspectSearch(val: string) {
    setProspectSearch(val)
    setProspectQuery(val)
  }
```

- [ ] **Step 8: Update handleProspectPick signature**

Find:
```typescript
  function handleProspectPick(prospect: typeof MOCK_PROSPECTS[0]) {
```

Replace with:
```typescript
  function handleProspectPick(prospect: ProspectSuggestion) {
```

Also update inside the function — find:
```typescript
    const linked = { fullname: prospect.fullname, email: prospect.email, firstname: prospect.firstname, company: prospect.company }
    setLinkedProspect(linked)
    setProspectSearch('')
    setProspectResults([])
```

Replace with:
```typescript
    const linked = { fullname: prospect.fullname ?? '', email: prospect.email ?? '', firstname: prospect.firstname ?? undefined, company: prospect.company ?? undefined }
    setLinkedProspect(linked)
    setProspectSearch('')
    setProspectQuery('')
    clearProspectResults()
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/components/emails/ComposeModal.tsx
git commit -m "feat: ComposeModal prospect search wired to live Supabase data"
```

---

## Task 3: Fix TemplateManager list view

**Files:**
- Create: `src/components/emails/TemplateListRow.tsx`
- Modify: `src/components/emails/TemplateManager.tsx` (lines 78–88)

**Context:** The list view currently renders a full `TemplateCard` (which is a tall card with accent bar, icon, subject box, body preview, variable chips, and footer) inside a `<div>` that already has a name and subject. This makes each list row contain a duplicate full card — visually broken. The fix is a compact `TemplateListRow` that shows: category dot · name · subject · variable count · action buttons.

- [ ] **Step 1: Create TemplateListRow**

```typescript
// src/components/emails/TemplateListRow.tsx
import { Edit2, Copy, Trash2 } from 'lucide-react'
import { TEMPLATE_CATEGORIES } from '@/constants/mockEmails'
import type { RichTemplateDB } from '@/types/campaigns'

const CATEGORY_DOT: Record<string, string> = {
  cold_outreach:    'bg-blue-500',
  outdated_website: 'bg-amber-500',
  no_website:       'bg-rose-500',
  follow_up:        'bg-violet-500',
  introduction:     'bg-emerald-500',
  proposal:         'bg-cyan-500',
  closing:          'bg-green-500',
  re_engagement:    'bg-orange-500',
  newsletter:       'bg-pink-500',
  general:          'bg-slate-400',
}

interface Props {
  template: RichTemplateDB
  onEdit: (t: RichTemplateDB) => void
  onDuplicate: (t: RichTemplateDB) => void
  onDelete: (id: string) => void
}

export function TemplateListRow({ template, onEdit, onDuplicate, onDelete }: Props) {
  const categoryLabel = TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label ?? template.category
  const dot = CATEGORY_DOT[template.category] ?? 'bg-slate-400'

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl hover:shadow-sm transition-shadow group">
      {/* Category dot */}
      <div className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />

      {/* Name + category */}
      <div className="w-48 shrink-0 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{template.name}</p>
        <p className="text-[10px] text-muted-foreground">{categoryLabel}</p>
      </div>

      {/* Subject */}
      <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{template.subject}</p>

      {/* Variable count */}
      {template.variables && template.variables.length > 0 && (
        <span className="shrink-0 text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
          {template.variables.length} vars
        </span>
      )}

      {/* Actions */}
      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" aria-label="Edit" onClick={() => onEdit(template)}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Duplicate" onClick={() => onDuplicate(template)}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" aria-label="Delete" onClick={() => onDelete(template.id)}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update TemplateManager list view**

In `src/components/emails/TemplateManager.tsx`, add the import at the top:
```typescript
import { TemplateListRow } from './TemplateListRow'
```

Find the list view block (lines 78–88):
```typescript
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="flex items-center gap-4 p-3 bg-card border border-border rounded-xl hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                </div>
                <TemplateCard template={t} onEdit={openEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
              </div>
            ))}
          </div>
        )}
```

Replace with:
```typescript
        ) : (
          <div className="space-y-1.5">
            {filtered.map(t => (
              <TemplateListRow
                key={t.id}
                template={t}
                onEdit={openEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: no errors, build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/emails/TemplateListRow.tsx src/components/emails/TemplateManager.tsx
git commit -m "fix: TemplateManager list view uses compact TemplateListRow instead of full card"
```

---

## Task 4: Enable pg_cron for hourly batch email send (B13 — Manual SQL)

**Files:** None (SQL executed in Supabase Dashboard)

**Context:** This is the final step to activate the automated campaign email system. The `send-campaign-batch` Edge Function is already deployed. pg_cron will call it every hour. The Supabase project ref is `wrtyatftfipchzrsehvl`.

- [ ] **Step 1: Open Supabase SQL Editor**

Go to: `https://supabase.com/dashboard/project/wrtyatftfipchzrsehvl/sql/new`

- [ ] **Step 2: Enable pg_cron extension**

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Run it. Expected: `Success. No rows returned.`

- [ ] **Step 3: Enable pg_net extension (required for HTTP calls from cron)**

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Run it. Expected: `Success. No rows returned.`

- [ ] **Step 4: Get your service role key**

Go to: Supabase Dashboard → Settings → API → copy the `service_role` key (the long one, NOT anon).

- [ ] **Step 5: Schedule the hourly batch**

Replace `YOUR_SERVICE_ROLE_KEY` with the key from Step 4:

```sql
SELECT cron.schedule(
  'send-campaign-batch-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://wrtyatftfipchzrsehvl.supabase.co/functions/v1/send-campaign-batch',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Run it. Expected: returns a cron job ID (integer).

- [ ] **Step 6: Verify the job was created**

```sql
SELECT jobid, schedule, command, active
FROM cron.job
WHERE jobname = 'send-campaign-batch-hourly';
```

Expected: one row with `active = true` and `schedule = '0 * * * *'`

- [ ] **Step 7: (Optional) Test immediately**

To trigger a send right now without waiting for the hour:
```sql
SELECT net.http_post(
  url     := 'https://wrtyatftfipchzrsehvl.supabase.co/functions/v1/send-campaign-batch',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
  ),
  body    := '{}'::jsonb
);
```

Then check Edge Function logs in Supabase Dashboard → Edge Functions → `send-campaign-batch` → Logs.

---

## Execution Order

| # | Task | Type | Effort |
|---|------|------|--------|
| 1 | `useProspectSearch` hook | Code | 10 min |
| 2 | Wire ComposeModal to real prospects | Code | 15 min |
| 3 | Fix TemplateManager list view | Code | 10 min |
| 4 | Enable pg_cron (B13) | Manual SQL | 5 min |

Tasks 1–3 are code changes and must run `npx tsc --noEmit` before committing. Task 4 is manual SQL — no code commit needed.
