# MCP Connector Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only card to Settings → API showing the `crm-mcp` connector URL, a copy button, and a manual reachability check — never storing or displaying the bearer token, since Supabase Edge Function Secrets can't be read back through any API.

**Architecture:** One new component, `src/components/settings/McpConnectorCard.tsx`, rendered as a new section inside the existing `src/components/settings/ApiTab.tsx`. One line in `ApiTab.tsx` changes (`CopyButton` gets exported) so the new file can reuse it instead of duplicating it.

**Tech Stack:** React + TypeScript, existing Tailwind utility classes matching the surrounding sections, `lucide-react` icons.

## Global Constraints

- Never store or display the `CRM_MCP_TOKEN` value anywhere in the app — Supabase Edge Function Secrets cannot be read back through any API (spec non-goal).
- URL is derived from `import.meta.env.VITE_SUPABASE_URL` — no new env var, no hardcoded project ref.
- "Test Connection" only proves reachability (`OPTIONS` request, no token) — it cannot and must not claim to verify auth.
- No new database table, service file, or edge function — pure frontend addition.
- No automated frontend test suite exists for this project — verification is manual (matches convention).

---

## File Structure

```
crm-app/src/components/settings/
  ApiTab.tsx              — MODIFY: export CopyButton, import + render McpConnectorCard
  McpConnectorCard.tsx    — CREATE: the new section
```

---

### Task 1: Export `CopyButton`, create `McpConnectorCard`, wire it into `ApiTab`

**Files:**
- Modify: `crm-app/src/components/settings/ApiTab.tsx:22` (export `CopyButton`)
- Modify: `crm-app/src/components/settings/ApiTab.tsx:14` (add import)
- Modify: `crm-app/src/components/settings/ApiTab.tsx:601` (render new section, right after Integrations, before Modals)
- Create: `crm-app/src/components/settings/McpConnectorCard.tsx`

**Interfaces:**
- Consumes: `CopyButton` (named export, `{ text: string; size?: 'sm' | 'lg' }`) from `./ApiTab.tsx`.
- Produces: `McpConnectorCard` (named export, no props) from `./McpConnectorCard.tsx`, rendered with no props in `ApiTab.tsx`.

- [ ] **Step 1: Export `CopyButton` in `ApiTab.tsx`**

Change line 22 from:
```typescript
function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'lg' }) {
```
to:
```typescript
export function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'lg' }) {
```

- [ ] **Step 2: Add the import in `ApiTab.tsx`**

After line 14 (`import { supabase } from '@/lib/supabase'`), add:
```typescript
import { McpConnectorCard } from './McpConnectorCard'
```

- [ ] **Step 3: Write `McpConnectorCard.tsx`**

```typescript
import { useState } from 'react'
import { Bot, Link, Check, X, Loader2 } from 'lucide-react'
import { CopyButton } from './ApiTab'

type TestStatus = 'idle' | 'checking' | 'ok' | 'fail'

export function McpConnectorCard() {
  const [status, setStatus] = useState<TestStatus>('idle')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-mcp`

  async function testConnection() {
    setStatus('checking')
    try {
      const res = await fetch(url, { method: 'OPTIONS' })
      setStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setStatus('fail')
    }
  }

  const sectionHd = 'text-sm font-semibold text-foreground'
  const sectionSub = 'text-xs text-muted-foreground mt-0.5'

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <h3 className={sectionHd}>MCP Connector (claude.ai)</h3>
            <p className={sectionSub}>Let Claude read and act on your CRM data via a Custom Connector</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <code className="flex-1 text-xs font-mono text-foreground truncate">{url}</code>
          <CopyButton text={url} />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testConnection}
            disabled={status === 'checking'}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60 transition-colors"
          >
            {status === 'checking' && <Loader2 className="h-3 w-3 animate-spin" />}
            Test Connection
          </button>

          {status === 'ok' && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Reachable
            </span>
          )}
          {status === 'fail' && (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive">
              <X className="h-3.5 w-3.5" /> Unreachable
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          Register this URL as a Custom Connector in claude.ai (Settings → Connectors), with an{' '}
          <code className="font-mono bg-muted px-1 rounded">Authorization: Bearer &lt;CRM_MCP_TOKEN&gt;</code>{' '}
          request header. Find or rotate the token in Supabase Dashboard → Edge Functions → Secrets
          — it can't be shown here since Supabase doesn't expose secret values back through any API.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Render it in `ApiTab.tsx`**

After the Integrations section's closing `</div>` at line 601, and before the `{/* ── Modals ─────────────────────────────────────────── */}` comment at line 603, insert:

```typescript
      {/* ── MCP Connector ──────────────────────────────────── */}
      <McpConnectorCard />

```

- [ ] **Step 5: Type-check**

Run: `cd crm-app && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `cd crm-app && npm run dev`
Open the app, navigate to Settings → API tab. Confirm:
- A new "MCP Connector (claude.ai)" card appears (placement: after Third-Party Integrations, before any modals).
- The URL shown matches `<your VITE_SUPABASE_URL>/functions/v1/crm-mcp` exactly (e.g. `https://wrtyatftfipchzrsehvl.supabase.co/functions/v1/crm-mcp` for this project).
- Clicking the copy icon copies the URL (button flips to a checkmark for 2s, matching the existing `CopyButton` behavior used elsewhere on the page).
- Clicking "Test Connection" shows a brief spinner, then "✓ Reachable" in green (the `crm-mcp` function is already deployed and live as of this session).
- The footer instructions text is legible and matches the wording above.

- [ ] **Step 7: Commit**

```bash
git add crm-app/src/components/settings/ApiTab.tsx crm-app/src/components/settings/McpConnectorCard.tsx
git commit -m "feat(settings): add MCP connector card to Settings > API tab

Shows the crm-mcp connector URL (derived from VITE_SUPABASE_URL) with
a copy button and an OPTIONS-based reachability check. Does not store
or display the bearer token — Supabase Edge Function Secrets can't be
read back through any API, so the token stays exclusively in the
Supabase Dashboard."
```

---

## Post-plan note

This is intentionally a single task — the whole feature is one small component plus a one-line
export change, with no natural sub-boundary worth a separate review gate.
