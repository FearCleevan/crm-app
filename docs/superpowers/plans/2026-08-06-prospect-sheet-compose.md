# Prospect Detail Sheet → Compose Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the prospect detail sheet's Email icon (and its Emails tab's Send Email button) to the app's existing floating Compose window, pre-linked to that prospect, and make a real send from that window flip the prospect's status from `New` to `Contacted`.

**Architecture:** Four small, sequential changes: (1) `send-email` edge function + `email.service.ts` learn to accept a `prospectId` and perform an upgrade-only status bump; (2) `ComposeModal` learns to accept a full prospect record (`initialProspect`) instead of just a bare email string, and reports back when a send bumped status; (3) `ProspectDetailSheet` swaps its two `mailto:` links for a callback prop; (4) `ProspectsPage` wires all three together — owns the Compose-open state, supplies real templates, and patches its local prospect snapshot when a bump happens.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + Edge Functions/Deno), Resend (outbound email), Tailwind.

## Global Constraints

- No test suite exists in this project (no Jest/Vitest configured) — verification is `tsc -b --noEmit`, `npm run build`, and manual click-through in the browser, per this project's established practice.
- Never downgrade a prospect's status — only bump `New → Contacted`, exactly mirroring the existing pattern in `supabase/functions/crm-mcp/tools/outreach.ts`.
- Scheduled sends (`send-scheduled-emails`) are explicitly out of scope — do not touch that function.
- Switching the outbound sending domain/provider (Zoho) is a separate, deferred project — do not touch `RESEND_FROM_EMAIL`, the `reply_to` value, or add any Zoho code in this plan.
- Follow the existing best-effort error pattern already in `send-email/index.ts`: a failed status update must never fail the email send itself — only `console.warn`.

---

### Task 1: `send-email` edge function — accept `prospectId`, bump status

**Files:**
- Modify: `supabase/functions/send-email/index.ts:45-139`

**Interfaces:**
- Consumes: nothing new from other tasks (this is the first task).
- Produces: the function's JSON response now includes `status_updated: boolean`. Task 2 (`email.service.ts`) reads this field.

- [ ] **Step 1: Add `prospectId` to the parsed request body type and destructure it**

Replace the body-parsing block (currently lines 44-53):

```ts
    // ── 2. Parse body ─────────────────────────────────────────
    let body: { to?: unknown; cc?: unknown; subject?: unknown; html?: unknown; threadId?: unknown; prospectId?: unknown }
    try {
      body = await req.json()
    } catch (e) {
      console.error('[send-email] body parse error:', e)
      return json({ error: 'Invalid request body' }, 400)
    }

    const { to, cc, subject, html, threadId, prospectId } = body
```

- [ ] **Step 2: Insert the status-bump block after the Resend send succeeds, before the activity-log block**

Find this existing code (currently around lines 94-101):

```ts
    const resendData = await resendRes.json().catch(() => null)
    console.log('[send-email] Resend status:', resendRes.status, JSON.stringify(resendData))

    if (!resendRes.ok) {
      return json({ error: resendData?.message ?? 'Failed to send email' }, 502)
    }

    // ── 5. Log to activities (best-effort) ────────────────────
```

Insert a new numbered step between the `if (!resendRes.ok)` block and the `// ── 5. Log to activities` comment, and renumber the two comments that follow it (`5.` → `6.`, `6.` → `7.`):

```ts
    const resendData = await resendRes.json().catch(() => null)
    console.log('[send-email] Resend status:', resendRes.status, JSON.stringify(resendData))

    if (!resendRes.ok) {
      return json({ error: resendData?.message ?? 'Failed to send email' }, 502)
    }

    // ── 5. Bump prospect status New -> Contacted (upgrade-only, best-effort) ──
    // Same guard as crm-mcp/tools/outreach.ts's send_outreach_email tool: a send
    // is a weak signal the prospect has been reached out to, but must never
    // downgrade an already further-along status (Qualified/Closed/etc).
    let statusUpdated = false
    if (typeof prospectId === 'number') {
      const { data: prospectRow, error: prospectErr } = await admin
        .from('prospects')
        .select('status')
        .eq('id', prospectId)
        .maybeSingle()
      if (prospectErr) {
        console.warn('[send-email] prospect lookup failed:', prospectErr.message)
      } else if (prospectRow?.status === 'New') {
        const { error: statusErr } = await admin
          .from('prospects')
          .update({ status: 'Contacted', updated_on: new Date().toISOString() })
          .eq('id', prospectId)
        if (statusErr) console.warn('[send-email] status update failed:', statusErr.message)
        else statusUpdated = true
      }
    }

    // ── 6. Log to activities (best-effort) ────────────────────
```

- [ ] **Step 3: Renumber the webhook comment and update the final return statement**

Find (currently around line 118 and 134):

```ts
      // ── 6. Fire webhook event (fire-and-forget) ───────────────
```

Change to:

```ts
      // ── 7. Fire webhook event (fire-and-forget) ───────────────
```

Find the final return (currently line 134):

```ts
    return json({ success: true })
```

Change to:

```ts
    return json({ success: true, status_updated: statusUpdated })
```

- [ ] **Step 4: Deploy and verify manually via Supabase Dashboard**

This project deploys Edge Functions via the Supabase Dashboard (paste the file contents into the function's code editor and click Deploy) — there is no CLI deploy step in this workflow. After deploying, the function must still work for existing callers that don't send `prospectId` (it's optional — `typeof prospectId === 'number'` guards the whole block, so omitting it is a no-op, exactly like today).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-email/index.ts
git commit -m "feat: bump prospect status New->Contacted on send-email when prospectId is supplied"
```

---

### Task 2: `email.service.ts` — pass `prospectId` through, return `statusUpdated`

**Files:**
- Modify: `src/services/email.service.ts`

**Interfaces:**
- Consumes: `send-email` edge function response `{ success: boolean; status_updated?: boolean }` from Task 1.
- Produces: `emailService.send(params): Promise<{ statusUpdated: boolean }>` — Task 3 (`ComposeModal.handleSend`) calls this and reads `.statusUpdated`.

- [ ] **Step 1: Add `prospectId` to `SendEmailParams` and change `send()`'s return type**

Replace the full file content:

```ts
import { supabase } from '@/lib/supabase'

interface SendEmailParams {
  to:       string | string[]
  cc?:      string | string[]
  bcc?:     string | string[]
  subject:  string
  html:     string
  threadId?: string
  prospectId?: number | null
}

interface ScheduleSendParams extends SendEmailParams {
  scheduledAt: string
  userId: string
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

export const emailService = {
  async send(params: SendEmailParams): Promise<{ statusUpdated: boolean }> {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params,
    })
    if (error) throw new Error(error.message ?? 'Failed to send email')
    return { statusUpdated: Boolean((data as { status_updated?: boolean } | null)?.status_updated) }
  },

  async scheduleSend(params: ScheduleSendParams): Promise<void> {
    const { error } = await supabase.from('scheduled_emails').insert({
      created_by:    params.userId,
      to_addresses:  toArray(params.to),
      cc_addresses:  toArray(params.cc),
      bcc_addresses: toArray(params.bcc),
      subject:       params.subject,
      html:          params.html,
      scheduled_at:  params.scheduledAt,
      status:        'pending',
    })
    if (error) throw new Error(error.message ?? 'Failed to schedule email')
  },
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: fails right now (until Task 3 updates `ComposeModal`'s call site to match the new return type) — that's fine, continue to Task 3 before checking again.

- [ ] **Step 3: Commit**

```bash
git add src/services/email.service.ts
git commit -m "feat: thread prospectId through emailService.send and surface statusUpdated"
```

---

### Task 3: `ComposeModal.tsx` — `initialProspect` prop + `onSent` callback

**Files:**
- Modify: `src/components/emails/ComposeModal.tsx`

**Interfaces:**
- Consumes: `emailService.send(params): Promise<{ statusUpdated: boolean }>` from Task 2.
- Produces: two new optional props on `ComposeModalProps`:
  - `initialProspect?: { id: number; fullname: string; email: string; firstname?: string; lastname?: string; company?: string; jobtitle?: string; website?: string }`
  - `onSent?: (prospectId: number) => void`
  Task 4 (`ProspectsPage`) supplies both.

- [ ] **Step 1: Add `useEffect` to the React import**

Find (line 1):

```ts
import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
```

Replace with:

```ts
import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react'
```

- [ ] **Step 2: Extend `ComposeModalProps`**

Find (lines 149-158):

```ts
interface ComposeModalProps {
  open: boolean
  onClose: () => void
  onSend: () => void
  onSaveDraft: (draft: DraftPayload) => void
  templates?: RichTemplateDB[]
  initialTo?: string
  initialSubject?: string
  initialBody?: string
}
```

Replace with:

```ts
interface ComposeModalProps {
  open: boolean
  onClose: () => void
  onSend: () => void
  onSaveDraft: (draft: DraftPayload) => void
  templates?: RichTemplateDB[]
  initialTo?: string
  initialSubject?: string
  initialBody?: string
  initialProspect?: {
    id: number
    fullname: string
    email: string
    firstname?: string
    lastname?: string
    company?: string
    jobtitle?: string
    website?: string
  }
  onSent?: (prospectId: number) => void
}
```

- [ ] **Step 3: Destructure the two new props**

Find (lines 177-180):

```ts
export function ComposeModal({
  open, onClose, onSend, onSaveDraft, templates = [],
  initialTo = '', initialSubject = '', initialBody = '',
}: ComposeModalProps) {
```

Replace with:

```ts
export function ComposeModal({
  open, onClose, onSend, onSaveDraft, templates = [],
  initialTo = '', initialSubject = '', initialBody = '',
  initialProspect, onSent,
}: ComposeModalProps) {
```

- [ ] **Step 4: Seed `linkedProspect` from `initialProspect` whenever the modal opens for a (new) prospect**

The component never unmounts between opens (`open` just toggles an early `return null`), so a plain `useState` initializer only fires once. Add an effect that re-seeds the whole compose session — including clearing any leftover subject/body/template from a previous prospect — every time `open` becomes true with a given `initialProspect.id`.

Find the line right after the prospect-linker state declarations (currently around line 213-214):

```ts
  const { results: suggestions,     clear: clearToSuggestions }   = useProspectSearch(toSearchQuery)
  const { results: prospectResults, clear: clearProspectResults }  = useProspectSearch(prospectQuery)
```

Add immediately after it:

```ts

  // Re-seed a fresh message whenever Compose opens pre-linked to a prospect
  // (e.g. from the prospect detail sheet's Email icon). The component stays
  // mounted between opens, so without this a second prospect would inherit
  // the first one's subject/body/template.
  useEffect(() => {
    if (!open || !initialProspect) return
    setLinkedProspect(initialProspect)
    setToChips(initialProspect.email ? [initialProspect.email] : [])
    setCcChips([])
    setBccChips([])
    setSubject('')
    setBody('<p></p>')
    setSelectedTemplate(null)
    setPreviewMode(false)
    setPresetKey(k => k + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialProspect?.id])
```

- [ ] **Step 5: Pass `prospectId` on send and call `onSent` after a bump**

Find the non-scheduled send block (currently lines 349-366):

```ts
    setSending(true)
    try {
      await emailService.send({
        to:      toChips,
        ...(ccChips.length > 0 ? { cc: ccChips } : {}),
        ...(bccChips.length > 0 ? { bcc: bccChips } : {}),
        subject: subject || '(no subject)',
        html:    getFinalHtml(),
      })
      onSend()
      toast.success('Email sent')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }
```

Replace with:

```ts
    setSending(true)
    try {
      const result = await emailService.send({
        to:      toChips,
        ...(ccChips.length > 0 ? { cc: ccChips } : {}),
        ...(bccChips.length > 0 ? { bcc: bccChips } : {}),
        subject: subject || '(no subject)',
        html:    getFinalHtml(),
        prospectId: linkedProspect?.id ?? null,
      })
      onSend()
      if (result.statusUpdated && linkedProspect) onSent?.(linkedProspect.id)
      toast.success('Email sent')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS (this closes out the type error left open at the end of Task 2).

- [ ] **Step 7: Commit**

```bash
git add src/components/emails/ComposeModal.tsx
git commit -m "feat: accept initialProspect + onSent in ComposeModal for prefilled outreach sends"
```

---

### Task 4: `ProspectDetailSheet.tsx` — replace both `mailto:` links with an `onEmail` callback

**Files:**
- Modify: `src/components/prospects/ProspectDetailSheet.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: new required prop `onEmail: () => void` on `ProspectDetailSheetProps`. Task 5 (`ProspectsPage`) supplies it.

- [ ] **Step 1: Add `onEmail` to the props interface**

Find (lines 102-107):

```ts
interface ProspectDetailSheetProps {
  prospect: Prospect
  onClose: () => void
  onUpdate: (values: ProspectFormValues) => Promise<void>
  onDelete: () => Promise<void>
}
```

Replace with:

```ts
interface ProspectDetailSheetProps {
  prospect: Prospect
  onClose: () => void
  onUpdate: (values: ProspectFormValues) => Promise<void>
  onDelete: () => Promise<void>
  onEmail: () => void
}
```

- [ ] **Step 2: Destructure `onEmail`**

Find (line 109):

```ts
export function ProspectDetailSheet({ prospect, onClose, onUpdate, onDelete }: ProspectDetailSheetProps) {
```

Replace with:

```ts
export function ProspectDetailSheet({ prospect, onClose, onUpdate, onDelete, onEmail }: ProspectDetailSheetProps) {
```

- [ ] **Step 3: Replace the header Email icon link**

Find (lines 270-273):

```tsx
                  <a href={`mailto:${prospect.email}`}
                    className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors" title="Email">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
```

Replace with:

```tsx
                  <button type="button" onClick={onEmail}
                    className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors" title="Email">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
```

- [ ] **Step 4: Replace the Emails tab's "Send Email" link**

Find (lines 508-511):

```tsx
              <a href={`mailto:${prospect.email}`}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Mail className="h-4 w-4" /> Send Email
              </a>
```

Replace with:

```tsx
              <button type="button" onClick={onEmail}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Mail className="h-4 w-4" /> Send Email
              </button>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: fails until Task 5 updates the call site in `ProspectsPage.tsx` (which doesn't pass `onEmail` yet) — continue to Task 5 before checking again.

- [ ] **Step 6: Commit**

```bash
git add src/components/prospects/ProspectDetailSheet.tsx
git commit -m "feat: replace mailto: links with an onEmail callback in ProspectDetailSheet"
```

---

### Task 5: `ProspectsPage.tsx` — own Compose state, wire everything together

**Files:**
- Modify: `src/pages/ProspectsPage.tsx`

**Interfaces:**
- Consumes:
  - `ComposeModal` props `initialProspect`/`onSent` from Task 3.
  - `ProspectDetailSheet`'s new required `onEmail` prop from Task 4.
  - `useTemplates(userId: string | null)` from `@/hooks/useTemplates` (existing, unchanged) — returns `{ templates: RichTemplateDB[] }`.
  - `draftsService.createDraft(input: DraftInput): Promise<EmailDraft>` from `@/services/drafts.service` (existing, unchanged).
- Produces: nothing consumed elsewhere — this is the final integration point.

- [ ] **Step 1: Add the new imports**

Find (lines 22-23):

```ts
import { ProspectDetailSheet } from '@/components/prospects/ProspectDetailSheet'
import { PermissionGate } from '@/components/auth/PermissionGate'
```

Replace with:

```ts
import { ProspectDetailSheet } from '@/components/prospects/ProspectDetailSheet'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { ComposeModal, type DraftPayload } from '@/components/emails/ComposeModal'
import { useTemplates } from '@/hooks/useTemplates'
import { draftsService } from '@/services/drafts.service'
```

- [ ] **Step 2: Add `composeProspect` state next to `detailRow`**

Find (line 269):

```ts
  const [detailRow, setDetailRow] = useState<ProspectRow | null>(null)
```

Replace with:

```ts
  const [detailRow, setDetailRow] = useState<ProspectRow | null>(null)
  const [composeProspect, setComposeProspect] = useState<ProspectRow | null>(null)
```

- [ ] **Step 3: Fetch real templates**

Find (line 285):

```ts
  const detailProspect = detailRow ? rowToProspect(detailRow) : null
```

Replace with:

```ts
  const detailProspect = detailRow ? rowToProspect(detailRow) : null
  const { templates } = useTemplates(user?.id ?? null)
```

- [ ] **Step 4: Add the compose-sent and save-draft handlers next to `handleDetailDelete`**

Find (lines 386-391):

```ts
  const handleDetailDelete = useCallback(async () => {
    if (!detailRow) return
    await remove(detailRow.id)
    toast.success(`${detailRow.fullname ?? 'Prospect'} deleted`)
    setDetailRow(null)
  }, [detailRow, remove])
```

Replace with:

```ts
  const handleDetailDelete = useCallback(async () => {
    if (!detailRow) return
    await remove(detailRow.id)
    toast.success(`${detailRow.fullname ?? 'Prospect'} deleted`)
    setDetailRow(null)
  }, [detailRow, remove])

  const handleComposeSent = useCallback((prospectId: number) => {
    setDetailRow(prev => prev && prev.id === prospectId ? { ...prev, status: 'Contacted' } : prev)
  }, [])

  async function handleComposeSaveDraft(payload: DraftPayload) {
    if (!user?.id) return
    try {
      await draftsService.createDraft({
        user_id:     user.id,
        to_emails:   payload.to,
        cc_emails:   payload.cc,
        bcc_emails:  payload.bcc,
        subject:     payload.subject,
        body:        payload.body,
        template_id: payload.templateId,
        prospect_id: payload.prospectId,
      })
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save draft')
    }
  }
```

- [ ] **Step 5: Pass `onEmail` into `ProspectDetailSheet` and render `ComposeModal`**

Find (lines 683-690):

```tsx
      {detailProspect && detailRow && (
        <ProspectDetailSheet
          prospect={detailProspect}
          onClose={() => setDetailRow(null)}
          onUpdate={handleDetailUpdate}
          onDelete={handleDetailDelete}
        />
      )}
```

Replace with:

```tsx
      {detailProspect && detailRow && (
        <ProspectDetailSheet
          prospect={detailProspect}
          onClose={() => setDetailRow(null)}
          onUpdate={handleDetailUpdate}
          onDelete={handleDetailDelete}
          onEmail={() => setComposeProspect(detailRow)}
        />
      )}

      <ComposeModal
        open={!!composeProspect}
        templates={templates}
        initialProspect={composeProspect ? {
          id:        composeProspect.id,
          fullname:  composeProspect.fullname ?? '',
          email:     composeProspect.email ?? '',
          firstname: composeProspect.firstname ?? undefined,
          lastname:  composeProspect.lastname ?? undefined,
          company:   composeProspect.company ?? undefined,
          jobtitle:  composeProspect.jobtitle ?? undefined,
          website:   composeProspect.website ?? undefined,
        } : undefined}
        onClose={() => setComposeProspect(null)}
        onSend={() => {}}
        onSent={handleComposeSent}
        onSaveDraft={handleComposeSaveDraft}
      />
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc -b --noEmit`
Expected: PASS — this closes out the type error left open at the end of Task 4.

Run: `npm run build`
Expected: PASS with zero errors, per this project's standing Definition-of-Done rule.

- [ ] **Step 7: Manual verification in the browser**

1. Open a prospect whose status is `New`. Click the header Email icon → Compose opens bottom-right, pre-linked to that prospect (its name/email shown in the Prospect row, To field already filled), and the prospect detail sheet stays open behind it.
2. Pick a template from the Template dropdown → confirm `{{first_name}}` / `{{company}}` resolve to real values in the editor (not left as literal `{{...}}`).
3. Click Send → toast confirms "Email sent," and the sheet's status badge flips from "New" to "Contacted" without a manual page refresh.
4. Close and reopen Compose from a *different* prospect (still `New`) → confirm the subject/body/template from the previous prospect did NOT leak into this one (the Task 3 Step 4 reset).
5. Open a prospect already at `Qualified` (or any non-`New` status) and send an email to them → confirm their status stays unchanged (upgrade-only guard holds).
6. From the Emails tab of a prospect's detail sheet, click "Send Email" → confirm identical pre-linked Compose behavior.
7. Click "Save Draft" from a prospect-linked Compose session → confirm a toast success and no console error (drafts aren't surfaced anywhere on the Prospects page, so there's no list to visually check — this only confirms the write doesn't throw).

- [ ] **Step 8: Commit**

```bash
git add src/pages/ProspectsPage.tsx
git commit -m "feat: wire prospect detail sheet's Email actions to a prefilled Compose window"
```

---

## Self-Review Notes

- **Spec coverage:** `initialProspect` prop (spec §ComposeModal) → Task 3 Steps 2-4. `onEmail` callback replacing both mailto links (spec §ProspectDetailSheet) → Task 4. `useTemplates` + Compose state ownership + local `detailRow` patch (spec §ProspectsPage) → Task 5 Steps 1-5. `prospectId` + upgrade-only bump + best-effort error handling (spec §send-email) → Task 1. `emailService` threading + return type (spec §email.service.ts) → Task 2. Non-goals (scheduled sends, Zoho) are untouched by every task above — confirmed no task references `send-scheduled-emails` or Zoho.
- **Type consistency:** `ComposeModal`'s `initialProspect` shape (Task 3 Step 2) matches exactly what `ProspectsPage` constructs in Task 5 Step 5. `emailService.send`'s new return type `{ statusUpdated: boolean }` (Task 2) is what `ComposeModal.handleSend` destructures as `result.statusUpdated` (Task 3 Step 5). `onSent`/`handleComposeSent` both take `(prospectId: number)`.
- **Ordering:** Tasks 1→2→3→4→5 each leave a dangling type error resolved by the next task in sequence (called out explicitly in each task's type-check step) — this is intentional so each task's diff is small and reviewable, not a mistake to fix.
