# Frontend Implementation — Email Inbox / Sent / Drafts

<!-- Phase-by-phase. Execute one phase at a time. Stop after each phase, report, and wait for "Yes, Proceed". -->

## What already exists (confirmed by reading the code)

- `src/components/emails/EmailList.tsx` — fully built list view (avatar, star, labels, attachment icon, relative time), typed against `EmailMessage[]`, currently fed only by `MOCK_EMAILS`
- `src/components/emails/EmailDetail.tsx` — exists alongside it (not yet read in detail, but same mock-data pattern)
- `src/constants/mockEmails.ts` — already defines `EmailFolder = 'inbox' | 'sent' | 'drafts'` and the full `EmailMessage` shape — this is the exact contract the backend phases (see `EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md`) should normalize their real data into, so these components don't need to change shape, just data source

So this isn't a from-scratch UI build — it's reconnecting existing, already-designed components to real data, plus the nav entries to reach them.

## Phase 1 — Nav

**Goal:** Add Inbox / Sent / Drafts back into `EmailsPage.tsx`'s nav, alongside the existing Compose / Campaigns / Templates.

- Extend the `View` type and `NAV` array in `EmailsPage.tsx` to add `'inbox' | 'sent' | 'drafts'`
- Add corresponding icons (lucide-react has `Inbox`, `Send`, `FileEdit` or similar — pick to match existing style)
- Each new nav item renders `EmailList` + `EmailDetail` side-by-side (mail-client layout), same pattern the components already assume
- At this phase, still backed by `MOCK_EMAILS` filtered by folder — purely wiring the nav/layout first, data swap comes in Phase 2

## Phase 2 — Real data for Sent

**Goal:** Replace mock data for the Sent tab with `sentEmails.service.ts`'s `listSent()` (Backend Phase 1).

- New hook `src/hooks/useSentEmails.ts` — fetch + paginate, same shape as other list hooks in this codebase (e.g. `usePipelineSessions.ts`'s pattern)
- Wire into the Sent nav view
- Confirm the earlier Ontario test send and any real campaign sends actually appear

## Phase 3 — Real Drafts

**Goal:** Replace mock drafts with real ones (Backend Phase 2), and make the Compose modal's Save Draft / resume-editing flow real.

- New hook `src/hooks/useDrafts.ts`
- `EmailsPage.tsx`'s `onSaveDraft` now calls the real `drafts.service.ts` functions instead of `() => {}`
- Clicking a draft in the Drafts list reopens `ComposeModal` pre-filled with that draft's `to`/`cc`/`bcc`/`subject`/`body`/linked template/prospect
- Add a delete action on each draft row (reuse `EmailList`'s existing row actions if present, or add one)

## Phase 4 — Inbox UI (depends on Backend Phase 0 decision)

- **If Option A (true inbound):** Inbox behaves like a real mail client — read real incoming messages, reply threads to the original, mark read/unread
- **If Option B (engagement feed):** Relabel the nav item accordingly (e.g. "Engagement" instead of "Inbox") so it's honest about showing opens/clicks rather than replies — this is a labeling decision, not just data wiring, so flagging it here rather than assuming
- **If Option C (manual reply log):** Add a lightweight "Log a reply" action from a prospect's detail view or from the Sent list, which becomes the read data source for a genuinely minimal Inbox view

Scope finalized once the backend decision is confirmed.

## Verification, every phase

- `npx tsc -b` clean
- Actually click through the UI with real data before calling a phase done (per repo convention — no test framework here, verification is build + manual check)
- Stop and report after each phase; wait for "Yes, Proceed" before the next
