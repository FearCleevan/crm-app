# Email Domain Warm-Up & Deliverability Strategy

Applies to the hand-picked cold-outreach list (see `GAME_PLAN.md`/`OUTREACH_TEMPLATES.md`) — a legitimate, small, personalized list, which is exactly the kind of sending pattern that stays safe with basic discipline.

---

## 1. Isolate the sending domain first

Don't send cold outreach from `peterpaullazan.com` root or `crm.peterpaullazan.com` directly — if it ever gets spam-flagged, it drags down the main portfolio/business domain and Paul CRM's transactional email (OTP, notifications) along with it.

- Use a dedicated subdomain just for outreach, e.g. `reach.peterpaullazan.com` or `hello-outreach.peterpaullazan.com`.
- Keep transactional email (CRM notifications, contact-form replies) on a separate subdomain from cold outreach — same separation principle used on Acme (transactional vs. marketing traffic never sharing one identity).

## 2. Fundamentals to set up before sending anything

- [ ] SPF record configured and verified on the sending (sub)domain
- [ ] DKIM record configured and verified
- [ ] DMARC policy set (start at `p=none` for monitoring, tighten later)
- [ ] A real, monitored mailbox that can send *and receive* — not a no-reply address; replies matter for reputation
- [ ] If the domain/subdomain is brand new, expect to need the full warm-up ramp below; an aged domain can move faster

## 3. Volume ramp (new domain/subdomain)

| Period | Volume/day |
|---|---|
| Week 1 | 5–10 |
| Week 2 | 15–25 |
| Week 3 | 30–50 |
| Week 4+ | 50–100, only if metrics stay healthy |

For a hand-picked list of 20–30 real prospects, you'll likely never need to ramp past Week 2 volume — low, personal volume is inherently the safest pattern there is, not a limitation to work around.

## 4. What actually protects reputation (matters more than raw volume)

- **One email per prospect, genuinely personalized** — identical bulk-template blasts are what spam filters key on, not raw count
- **Plain-text-first, minimal HTML, one link** — reads as human, not as a marketing campaign
- **Avoid spam-trigger patterns** — "free," "guarantee," excessive exclamation points/caps, too many links or images
- **Spread sends across the day**, timed to the recipient's business hours — not all sent at once
- **Keep bounce rate under ~2%** — verify addresses are real before sending; don't guess or scrape unverified emails
- **Watch reply/open rates** — engagement (opens, replies) is a positive signal to inbox providers; silence at scale is a negative one

## 5. Monitor and pause if needed

If bounce rate climbs past ~5%, or any spam complaints come in, stop and slow down rather than pushing through the ramp — recovering a damaged domain/IP reputation takes far longer than the few days saved by rushing it.

## 6. Standing reminder

This strategy is specifically for the small, hand-picked, individually-researched list. It is **not** a warm-up plan for the 51k secondhand lead list — see the standing rule in `README.md`. Good deliverability infrastructure solves inbox placement, not consent; it does not change the CASL exposure of an unverified list, regardless of how gradually it's sent.
