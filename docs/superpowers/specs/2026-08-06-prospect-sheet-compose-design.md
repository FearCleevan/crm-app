# Prospect Detail Sheet → Compose Wiring (2026-08-06)

## Problem

`ProspectDetailSheet.tsx` has an Email icon in its header (next to Edit/Call/Delete) and a
"Send Email" button on its Emails tab. Both are plain `mailto:` links — they hand off to the
user's OS mail client instead of using the CRM's own in-app Compose window
(`ComposeModal.tsx`), which already exists and is used on the Emails page. That window already
supports a template dropdown and a prospect-linker that resolves merge fields
(`{{first_name}}`, `{{company}}`, etc.).

Separately, sending an outreach email through the MCP tool (`send_outreach_email`) and through
the Resend webhook (on open/click/reply) already bump a prospect's status from `New` to
`Contacted`. Sending through the in-app Compose window — the path a human actually uses day to
day — does not. That's a real gap, not a doc-staleness issue.

## Goal

Clicking the Email icon (or the Emails tab's Send Email button) opens the existing floating
Compose window, pre-linked to that prospect (recipient auto-filled, merge fields resolvable),
while the prospect detail sheet stays open behind it. Sending an email while a prospect is
linked bumps that prospect's status `New → Contacted` (upgrade-only, never downgrades a
further-along status).

## Non-goals

- Scheduled sends (`send-scheduled-emails` cron path) are not touched — a scheduled email will
  not bump status yet. Flagged as a known follow-up.
- No changes to the sending domain/provider (still Resend). Switching outbound to
  `peter@peterpaullazan.com` via Zoho, plus building inbound reply-capture and in-app
  notifications for that mailbox, is a separate, larger project deferred by the user for later —
  not scoped here.

## Design

### `ComposeModal.tsx` — new `initialProspect` prop

Add an optional prop matching the existing internal `linkedProspect` shape:

```ts
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
```

When provided, seed `linkedProspect` state and `toChips` from it on mount (same effect as
picking the prospect from the search box manually, so template merge-field resolution works
identically). This fixes a real limitation of the existing `initialTo` prop, which only fills
the To field as a bare string with no linked prospect — meaning templates picked afterward
would resolve merge fields blank. `initialTo` keeps working as-is for callers that don't have a
full prospect record.

### `ProspectDetailSheet.tsx` — replace `mailto:` with a callback

- New prop: `onEmail: () => void`.
- Header Email icon (`<a href="mailto:...">`) becomes a `<button onClick={onEmail}>`.
- Emails tab's "Send Email" link becomes the same button.
- No other change to the sheet — it does not close, and does not know anything about Compose
  internals.

### `ProspectsPage.tsx` — owns Compose state

- Add `useTemplates(userId)` (same hook already used by `EmailsPage.tsx`) so real templates are
  available here too.
- New state: `composeProspect: ProspectRow | null`.
- `onEmail={() => setComposeProspect(detailRow)}` passed into `ProspectDetailSheet`.
- Render `<ComposeModal open={!!composeProspect} initialProspect={...} templates={templates}
  onClose={() => setComposeProspect(null)} ... />` alongside the existing modals at the bottom
  of the component — floats over the page exactly like it already does on the Emails page,
  independent of the detail sheet.
- After a successful send that reports a status bump, patch `detailRow` locally (same pattern
  `handleDetailUpdate` already uses: `setDetailRow({ ...detailRow, status: 'Contacted' })`) so
  the sheet's badge updates immediately. The table view already has a live realtime subscription
  on the `prospects` table and will pick up the change on its own.

### `send-email/index.ts` — the actual status-bump fix

- Accept optional `prospectId: number` in the request body.
- If present: fetch that prospect's current `status`. If it is exactly `'New'`, update it to
  `'Contacted'` (same upgrade-only guard already proven in
  `crm-mcp/tools/outreach.ts` — never downgrade Qualified/Closed/etc.).
- Response gains `status_updated: boolean` so the frontend knows whether to patch local state.
- Failure to update status must not fail the send — log a warning and continue, matching the
  existing best-effort pattern already used for activity logging in this same function.

### `email.service.ts` — pass the id through

- `SendEmailParams` gains an optional `prospectId?: number | null`.
- `emailService.send()` forwards it in the request body and returns
  `{ statusUpdated: boolean }` from the edge function response (currently the function returns
  void to the caller).

### `ComposeModal.handleSend()` — supply the id

- Pass `prospectId: linkedProspect?.id ?? null` into `emailService.send(...)`.
- On success, if `linkedProspect` is set and the response reports a bump, call a new
  `onSent?: (prospectId: number) => void` callback (optional prop) so `ProspectsPage` can patch
  `detailRow` without `ComposeModal` needing to know about the prospect sheet at all.

## Error handling

- If the status-update query fails, the function still returns success for the send itself
  (email delivery already succeeded via Resend by that point) — only logs a warning
  server-side, same as the existing activity-log best-effort block.
- If `prospectId` is omitted or the prospect can't be found, behavior is unchanged from today —
  no status mutation attempted.

## Testing

- Manual verification (no test suite exists in this project — confirmed in prior audits):
  1. Open a prospect with status `New`, click the header Email icon → Compose opens pre-linked,
     sheet stays open.
  2. Pick a template, confirm `{{first_name}}`/`{{company}}` resolve in the editor.
  3. Send → toast confirms, sheet's status badge flips to `Contacted` without a manual refresh.
  4. Repeat with a prospect already at `Qualified` or later → confirm status does NOT downgrade.
  5. Repeat via the Emails tab's Send Email button → same behavior.
  6. `tsc -b --noEmit` and `npm run build` clean, per this project's standing verification rule.
