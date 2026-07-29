# Session Handoff — July 28, 2026

Supersedes `SESSION_HANDOFF_2026-07-27.md` (kept for history — job-loss context, pricing,
Zoho decision, standing preferences below are still all current). This session's focus:
picking up the Ontario restaurant outreach batch and figuring out how to actually send it.

---

## Land-First-Client folder moved into this repo

`E:\Projects Version 2\Land-First-Client\` (referenced by the 07-27 handoff as "a separate
folder, not this repo") **has been moved** to `crm-app/Land-First-Client/` at the user's
request, so it's visible directly inside the CRM project. All 11 files (`GAME_PLAN.md`,
`HOW_TO_LAND_YOUR_FIRST_CLIENT.md`, `PRICING_PACKAGES.md`, `OUTREACH_TEMPLATES.md`,
`ONTARIO_RESTAURANTS_OUTREACH_DRAFTS.md`, `WARMUP_STRATEGY.md`,
`CASE_STUDY_ACME_VINTAGE_SUPPLY.md`, `VISUAL_EMAIL_GUIDE.md`, `README.md`, 2 HTML template
files) are now untracked in this repo's git working tree — not yet committed, that's a decision
for the user. **Update any future reference to the old `E:\` path — it no longer exists there.**

## Ontario restaurant batch — real email addresses verified this session

Of the 8 restaurants in `ONTARIO_RESTAURANTS_OUTREACH_DRAFTS.md`, actually checked each site
live for a real contact email (the file itself flagged this as never having been done):

| # | Restaurant | City | Email status |
|---|---|---|---|
| 1 | Veslo Family Restaurant | Kitchener | ❌ No public email — phone only (site + Facebook checked) |
| 2 | Trattoria Caffe Italia | Ottawa | ✅ **info@trattoriaitalia.com** (site footer) |
| 3 | Richie's Family Restaurant | London | ✅ **richiebrpp@gmail.com** (site footer) |
| 4 | Louis Restaurant | Windsor | ❌ No public email. SSL bug **confirmed real** — site shows a mismatched JustHost placeholder cert |
| 5 | Rose & Crown | Kingston | ❌ No public email — contact form only, no address shown |
| 6 | Town & Country Restaurant | London | ✅ **info@townandcountry.ca** (site footer) |
| 7 | Family Circle Restaurant | London | ❌ Site fully down (`ECONNREFUSED`, not just the SSL issue originally flagged) — but Yelp reviews as recent as June 2026, so still operating. No email found. |
| 8 | Meetpoint | Waterloo | ⚠️ **Appears closed** — Yelp and Uber Eats both list it closed since ~Dec 2024. Recommend dropping this one, not just re-verifying. |

**Net result: only 3 of 8 (Trattoria Caffe Italia, Richie's, Town & Country) have a usable email
today.** User explicitly chose to proceed with just these 3 for now rather than chase the other 5
or find replacements.

**None of the 3 have been added as CRM prospects yet** — blocked on no DB write access from this
session (see below). This is the literal next step whenever this resumes.

**Exact field values to use when adding them** (`ProspectForm.tsx` requires firstname, lastname,
company, email — all four are hard-required by the zod schema):

| Field | Trattoria Caffe Italia | Richie's Family Restaurant | Town & Country Restaurant |
|---|---|---|---|
| First Name | there | there | there |
| Last Name | Team *(filler — required field, never rendered)* | Team | Team |
| Company | Trattoria Caffe Italia | Richie's Family Restaurant | Town & Country Restaurant |
| Email | info@trattoriaitalia.com | richiebrpp@gmail.com | info@townandcountry.ca |
| Website | trattoriaitalia.com | richieslondon.com | townandcountryrestaurant.ca |
| City | Ottawa | London | London |
| State | ON | ON | ON |
| Country | Canada | Canada | Canada |
| Industry | Restaurant | Restaurant | Restaurant |
| Status | New | New | New |
| Comments | Legacy CMS (old tabid-style URLs), early-2000s design — site-rescue pitch | Stale since 2023, no online ordering/menu — site-rescue pitch | Menus are PDF-only, no online ordering — site-rescue pitch |

**`{{observation}}` line for each** (goes into the "Solo Developer Story" template, see below):

1. Trattoria Caffe Italia — *"it's still running on an older content platform (the URL structure
   gives it away) — it works, but that legacy weight typically hurts load speed and mobile
   visitors."*
2. Richie's Family Restaurant — *"the site hasn't been updated since 2023, and there's no way to
   view the menu or order online from it."*
3. Town & Country Restaurant — *"the menus are only available as PDF downloads rather than
   something visitors can browse directly on their phone — a common drop-off point for mobile
   visitors."*

## How the "Solo Developer Story" template actually works (real code, verified by reading it)

The HTML template shown to the user in the CRM's Template Library ("Solo Developer Story",
matches `Land-First-Client/solo-developer-story-email.html`) uses `{{first_name}}` and
`{{company}}` — both real, auto-resolving merge fields (`src/lib/mergeFields.ts`'s
`MERGE_FIELDS` list, 8 fixed tokens). It also uses `{{observation}}`, which is **deliberately
NOT a real merge field** anywhere in the codebase (confirmed absent from both the frontend
list and `send-campaign-batch/index.ts`'s `resolveVars`) — it's designed to render as literal
visible text in the Compose body editor, forcing a manual, human-verified edit per send. The
Preview tab highlights any unresolved `{{...}}` in orange (`highlightUnresolved()` in
`ComposeModal.tsx`) as a last-check before sending.

**Consequence: this template cannot be used via the Campaigns/bulk-send feature** —
`send-campaign-batch` only resolves the 8 fixed fields and would ship the literal string
`"{{observation}}"` to every recipient. It only works via one-at-a-time Compose sends, which is
fine for a batch of 3.

**Compose workflow, in order:** link the Prospect first (this is what makes `{{first_name}}`/
`{{company}}` resolve) → then pick the Template from the dropdown → then manually replace the
visible `{{observation}}` text in the body → check Preview for no orange → Send.

## CASL compliance audit — real finding, not just repeating last session's stated rule

The 07-27 handoff already stated a standing rule not to use the CRM's existing 51,864-row bulk
prospect list for outreach (no consent trail). This session **actually verified that with live
data** instead of just repeating the rule, using a throwaway script
(`scripts/_tmp-audit-prospects.mjs`, written, run, then deleted — not committed) that signed in
as the user's real `crm_users` account and paginated the full `prospects` table.

**Confirmed:**
- 51,863 of 51,864 rows have **null** `providercode` and `dispositioncode`.
- All but 2 rows are `status = 'New'`; almost the entire table shares one bulk-import date
  (2026-05-16).
- Zero comments/notes across the whole table except one row saying "Gwapo" (clearly a manual
  test entry).
- The `prospects_provider` lookup table (meant to map provider codes to human-readable names)
  is completely empty — provider codes were never even defined, let alone populated.

**Conclusion: there is no defensible, consent-documented subset of this list.** It's one
undifferentiated bulk import with no source metadata at all. Don't send to any part of it,
ever, without a real re-import that captures actual consent/source per row.

**Also resolved a separate point of confusion:** the user recalled a prior session (2026-07-25,
via the claude.ai Custom Connector, not Claude Code) where "10 prospects" were successfully
pulled and listed. Checked `project_mcp_connector.md` memory — that was a **read-only
connectivity smoke test** confirming `search_prospects` returns real data end-to-end, run the
same day the connector was finished. No filter was applied, so those 10 were almost certainly
from this same unconsented bulk pool — but critically, **nothing was ever sent** to them. It
wasn't evidence of a safe subset; it just proved the tool could read the table.

## Standing rule, reaffirmed with real evidence now

Never use the 51,864-row bulk prospect list for outreach — audited and confirmed unconsented
this session, not just asserted. Only the individually hand-picked Ontario restaurants (or
future similarly hand-picked prospects) are fair game for real sends.

## What's still open from 07-27, untouched this session

- Delete 2 leftover test prospects (ids `48372`, `52352`) — manual CRM UI only.
- GitHub repo description still says "Brisk CRM".
- OAuth consent-screen branding — 3 remaining "Brisk CRM" strings (`crm-mcp/oauth.ts`,
  `DEPLOY_BUNDLE.ts`, `authorize-form.ts`).
- `ProspectDetailSheet.tsx` Notes tab still fake/hardcoded; `CommandPalette.tsx` still searches
  mock data; no test suite configured.

## New todo, queued for next session (not started)

User shared a YouTube transcript (Chris Do–style "First 100 framework" — warm-network referral
outreach, not cold outreach) and asked for it to be turned into part of the actual strategy.
Analysis done, nothing written to files yet. Agreed next step:

- Add a **"Warm Network / Referral Ask"** section to `Land-First-Client/GAME_PLAN.md` — the video's
  channels (OnlineJobs.ph/Upwork/Indeed/cold outreach) don't include this at all currently.
  **Concrete first action, highest leverage, zero cost:** reach out to the **Acme Vintage Supply
  owner** (the one real completed client/case study) and ask "do you know anyone else who could
  use something like this?" — not "let me know if you hear of anyone." This is the single
  strongest warm lead available; nobody has asked for the referral yet.
- Caveat carried into the write-up: the video's literal "list 100 people you know" doesn't
  transplant well — user is PH-based targeting Canada/US SMB clients, so the personal network
  doesn't have the same density of matching prospects as the video assumes. Adapt rather than
  copy verbatim (prior freelance/GitHub contacts, PH friends working remotely for NA companies,
  etc. — thinner list, still worth building).
- Add a **tiered discovery-call pricing script** to `Land-First-Client/HOW_TO_LAND_YOUR_FIRST_CLIENT.md`
  — maps directly onto existing bands in `PRICING_PACKAGES.md`: Landing Page Sprint ($700–1,400)
  as low tier, Custom Website ($1,800–4,500) as mid, Web Application/System Design ($4,500–12,000+)
  as high. Ask "what range would you feel comfortable in?" instead of naming a price first.

## Standing preferences (carried from 07-27, still current)

- Never add a "Co-Authored-By: Claude" trailer to commit messages.
- Don't propose spending money while the user's stated they're broke.
- User is comfortable providing real CRM login credentials in-chat for one-off diagnostic
  scripts (done twice now: `send-email` verification 07-27, prospects audit 07-28) — always
  write these as throwaway scripts outside git tracking (or delete immediately after running)
  and never persist the password anywhere, including memory.

[[project_backlog_2026-07-28]] (Claude Code memory, if resuming there instead)
