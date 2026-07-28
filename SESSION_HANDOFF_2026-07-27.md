# Session Handoff — July 27, 2026

**Context:** Peter Paul Lazan (also Peter Paul / FearCleevan) lost his job at Acme Vintage Supply on 2026-07-15 (unrelated security incident, not performance). This session was about pivoting to freelance work — building his own client-acquisition plan and fixing real bugs in his own product, Paul CRM, along the way.

Read this first if you're picking up work on `crm-project`/`crm-app` fresh — it'll re-establish everything from this session without needing to re-derive it.

---

## The broader plan (lives in a different repo)

`E:\Projects Version 2\Land-First-Client\` (separate folder, not this repo) has the full freelance client-acquisition plan: `GAME_PLAN.md`, `HOW_TO_LAND_YOUR_FIRST_CLIENT.md`, pricing, outreach templates, and a batch of 8 individually-researched Ontario restaurant prospects with drafted personalized outreach (`ONTARIO_RESTAURANTS_OUTREACH_DRAFTS.md`).

**Status: none of the 8 have actually been contacted yet.** Real contact emails were never pulled from their sites, nothing's loaded into Paul CRM as real prospects, nothing's been sent for real. **This is the actual next revenue-generating step** — if this resurfaces, check this before suggesting more CRM feature work.

Standing rule: never use the original 51k-contact secondhand lead list already sitting in the `prospects` table (mostly `status = 'New'`, one bulk provider code) for outreach — no verifiable consent chain, real CASL exposure. Only the 8 hand-picked, individually-researched restaurants (or similar future hand-picked prospects) are fair game.

## Paul CRM — real bugs found and fixed this session

- **Duplicate signature on sends** — `send_outreach_email` (`crm-mcp/tools/outreach.ts` + its `DEPLOY_BUNDLE.ts` deploy copy) was unconditionally appending a hardcoded plain-text signature server-side, on top of whatever the email body already had. Fixed.
- **Template preview shredded HTML** — `TemplateModal.tsx`'s Preview tab and `ComposeModal.tsx`'s `handleTemplateSelect`/`handleProspectPick` all converted every `\n` in a template body to `<br/>`, which breaks any HTML tag whose attributes wrap onto a second line (e.g. `<img>`). Fixed with a `templateBodyToHtml()` helper that passes real HTML through as-is (same as the existing Newsletter/Promotional presets already did).
- **Compose Maximize button did nothing** — no `onClick` at all. Fixed, now actually expands the modal.
- **Sent tab query was ambiguous** — `activities` has two FKs to `crm_users` (`assigned_to`, `created_by`); `sentEmails.service.ts`'s embed needed `crm_users!created_by(...)` to disambiguate.
- **Save Draft was a total no-op** — `EmailsPage.tsx` passed `onSaveDraft={() => {}}`. Also `ComposeModal`'s `linkedProspect` never stored the prospect's `id`. Both fixed — `onSaveDraft` now passes a real `DraftPayload`.

## Feature status: Inbox / Sent / Drafts

Plans: `EMAIL_INBOX_SENT_DRAFTS_FRONTEND_IMPLEMENTATION.md` / `_BACKEND_IMPLEMENTATION.md` (this repo's root).

- **Phase 1 (nav)** ✅ shipped
- **Phase 2 (Sent, real data)** ✅ shipped — migration `021_activities_email_body.sql` run, all three send paths (`send_outreach_email`, `send-campaign-batch`, `send-scheduled-emails`) now persist `email_to`/`email_body`
- **Phase 3 (Drafts, real persistence)** ✅ shipped — migration `022_email_drafts.sql` run
- **Phase 4 (Inbox)** ❌ not built — blocked on a three-way decision (documented in the backend plan doc): (A) true inbound email infra, (B) relabel as an engagement/opens-clicks feed using data that already exists, (C) manual reply-logging stopgap. Not urgent, revisit when it comes up.

## Reply bounce — found, fixed, deployed and confirmed working

Discovered via a real bounce: `RESEND_FROM_EMAIL`'s sending subdomain (`mail.peterpaullazan.com`) has SPF/DKIM for outbound sending only, **no MX record** — any reply to an outreach email bounced outright. Fixed by adding `reply_to`/`replyTo` to all five Resend send call sites: `crm-mcp/tools/outreach.ts` (+ `DEPLOY_BUNDLE.ts`), `send-campaign-batch/index.ts`, `send-scheduled-emails/index.ts`, `send-email/index.ts`.

Address used: **`lazanpeterpaul@gmail.com`** (not `jonathan.mauring17@gmail.com` — that was tried first but doesn't match the "Peter Paul Lazan" identity everything is signed with, which would look mismatched/suspicious to a prospect replying).

**Confirmed deployed** — all four affected Edge Functions (`crm-mcp`, `send-campaign-batch`, `send-scheduled-emails`, `send-email`) were manually redeployed via the Supabase Dashboard (no CLI set up on this machine — `supabase` isn't installed, no `config.toml`/linked project) and the user confirmed completion.

## Zoho Mail — deferred on purpose, not abandoned

Attempted to set up a real receiving mailbox (`hello@peterpaullazan.com`) so replies land in a branded inbox instead of personal Gmail. Signup flow routed into `mailadmin.zoho.com`'s paid business console rather than surfacing a free tier; got to checkout for Mail Lite ($15/year, cheapest option found). **Not purchased — Peter is currently broke** (no income since the July 15 job loss). This is a real todo, not a rejected idea — revisit once there's income from a client. The `reply_to` stopgap above already covers the functional need in the meantime.

## Standing preferences for this user

- **Never add a "Co-Authored-By: Claude" trailer to commit messages.**
- Don't propose spending money on infrastructure/tooling polish while he's stated he's broke — free/cheap fixes first.
- All commits this session went straight to `main` (no PR workflow observed) — matches existing repo convention.

## Commits from this session (crm-app, `main`)

`03fd895` → `561f13a` → `a84bd36` → `d26d9a6` → `89eac5a` → `8e8cb43` — all pushed, all live on GitHub (`FearCleevan/crm-app`).
