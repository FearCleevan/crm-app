# Visual Outreach Email — Setup Guide

## What this solves

Plain-text outreach reads fine, but doesn't showcase you visually — no photo, no brand presence, no sense of who's actually reaching out. `solo-developer-story-email.html` is a real, self-contained HTML email (table-based, inline CSS, works in email clients) built around your actual identity: your photo, your name, your role, your domain, your GitHub, your WhatsApp — structured as a story (who you are → what you noticed about them → proof → what you offer → contact), not a bare pitch.

## What Paul CRM already has ready for this

Checked `crm-project/crm-app/src/components/emails/ComposeModal.tsx` directly — good news, most of the plumbing already exists:

- The auto-signature builder (`buildSignature`) already renders your photo (`profile_url`), name, role, email, phone, and has **your real WhatsApp number and GitHub link hardcoded already**.
- The compose modal already supports full custom HTML templates (see the existing Newsletter/Promotional presets — same table+inline-CSS pattern used in `solo-developer-story-email.html`).
- Merge fields (`{{first_name}}`, `{{company}}`, etc.) resolve automatically at send time via `resolveMergeFields`.

**One stale bug worth fixing:** `my_portfolio` is still hardcoded to the old `lazandev.vercel.app` in both `ComposeModal.tsx` and `TemplateModal.tsx`'s sample data — should be `https://www.peterpaullazan.com/`. Quick find-and-replace whenever you're in that codebase next.

**Fixed already:** the `send_outreach_email` MCP tool (used for the test send) was unconditionally appending a hardcoded plain-text signature server-side, in `supabase/functions/crm-mcp/tools/outreach.ts` and its deployable copy `DEPLOY_BUNDLE.ts` — this is what caused the duplicate signature under the HTML template's own footer in the test email. Removed the append in both files. **This requires redeploying the `crm-mcp` Edge Function via the Supabase Dashboard (paste `DEPLOY_BUNDLE.ts`'s contents) before the fix takes effect on real sends** — a local file edit alone doesn't update what's already live.

## Two templates, two situations

- **`solo-developer-story-email.html`** — use when you have a real, specific, verified observation about the prospect's site (the Ontario restaurants batch, for example). Converts better because it's genuinely personalized to a real problem, not a generic pitch. Uses `{{observation}}` as a deliberate must-fill placeholder (see below).
- **`solo-developer-general-outreach-email.html`** — use when you haven't verified a specific issue yet — broader/volume outreach, browsing profiles on OnlineJobs.ph, or a batch you haven't individually audited. No `{{observation}}` field; the pitch is a general "I offer these services" introduction instead. Lower conversion than the personalized version, but has zero per-prospect research cost, so it's the right tool for scale rather than depth.

Load both into the Template Library as separate templates so you can choose per prospect based on how much research you actually did on them.

**On `{{website}}`:** it's a real Paul CRM merge field, but the `create_prospect`/`update_prospect` MCP tools don't expose a `website` parameter — only `firstname`, `lastname`, `email`, `company`, `jobtitle`, `status`. So `{{website}}` resolves empty for any prospect added through those tools. If you want to reference it directly (e.g. "I took a look at {{website}}"), you'd need to fill that field in through the CRM app's own Add/Edit Prospect form instead, where it exists. Until then, `{{company}}` is the reliable anchor for the personalized template.

## How to load the template into Paul CRM

1. In the left sub-nav under **Emails**, click **Templates**, then **+ New Template**
2. Template Name: `Solo Developer Story`
3. Category: `Outdated Website` (more specific than `Cold Outreach` for this pitch angle — see below)
4. Subject: `Quick note about {{company}}'s website`
5. Body: paste the full contents of `solo-developer-story-email.html` as-is — leave `{{observation}}` in place, don't fill it in at save time

## Per-send checklist

- [ ] In Compose, select this template and link the real prospect (auto-resolves `{{first_name}}`/`{{company}}`)
- [ ] Manually type the real, specific observation about that prospect's site in place of `{{observation}}` in the editor
- [ ] Switch to Preview and confirm nothing is still highlighted orange — `{{observation}}` is deliberately not a real Paul CRM merge field, so it will **not** auto-resolve; an orange highlight means you forgot to replace it. Never send with it still showing.
- [ ] Leave the auto-signature **off** for this template — the HTML already has its own footer/signature block built in; adding both would duplicate your info (also fixed server-side, see below)

## Notes

- Photo is pulled live from `https://www.peterpaullazan.com/profile.png` — already hosted, no upload needed.
- Brand color (`#0c7c8d`) matches Paul CRM's own existing template color, so it reads as consistent if a prospect ever looks you up.
- This template is for your hand-picked outreach list only — see the standing rule on the 51k list in `README.md`.
