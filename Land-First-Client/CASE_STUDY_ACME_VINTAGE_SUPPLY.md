# Case Study Draft — Acme Vintage Supply

**Status:** Draft — adapt into a `/projects/acme-vintage-supply` page on the portfolio, matching the existing case-study template used by the other 15 projects. Fill in `[ ]` placeholders with real specifics/screenshots before publishing. Nothing here should be published with invented numbers — where a real metric isn't confirmed, say what was built, not a guessed result.

---

## Working title

**Acme Vintage Supply — Full-Stack E-Commerce Platform, Built Solo in ~2 Months**

## One-line summary (for the project grid/card)

A complete e-commerce platform — storefront, checkout, admin dashboard, CMS, security, and marketing automation — designed and built solo from scratch in under two months.

## Overview

Acme Vintage Supply is a live e-commerce business selling handcrafted antique oil lamp parts and reproduction signage. The engagement started as a storefront build and grew into the business's entire operating platform: the storefront customers buy from, and the admin system the business runs on day to day.

**Role:** Sole developer — frontend, backend, infrastructure, and ongoing feature delivery.
**Timeline:** ~7 weeks (late May – mid July 2026)
**Live at:** acmevintagesupply.com

## Tech stack

- **Frontend:** Next.js, Tailwind CSS, Zustand (cart state)
- **Commerce:** Shopify Storefront API (cart, checkout) + Shopify Admin API (orders, inventory, products)
- **Backend/data:** Supabase (CMS content, reviews, analytics, contact inbox, marketing)
- **Auth/security:** iron-session, OTP 2FA, bcrypt, Upstash Redis (rate limiting + OTP storage)
- **Email:** Resend (transactional + marketing), Tiptap (rich-text compose)
- **Deployment:** Vercel

## What was built

### Storefront
- Homepage, catalog, product detail pages, cart drawer + full cart page
- Multi-colour product variants with per-variant price/stock and a grouped, multi-select cart flow
- Multi-currency display (CAD/USD/EUR/GBP, auto-detected by country) via Shopify Markets
- Full mobile/tablet responsive pass
- On-page SEO: JSON-LD structured data, sitemap, breadcrumbs, FAQ schema

### Admin dashboard
- Orders (list + detail), real Shopify Admin API data — no mock data anywhere in production
- Inventory management, product create/edit (including colour-variant authoring)
- Customer list, including guest/anonymous cart activity merged into customer records on login
- Packing slip, pick list, and invoice generation directly from an order's detail page
- Traffic analytics and admin activity log (who changed what, when)
- Notification system covering contact messages, pending reviews, restock signups

### Content management
- Custom CMS (built on Supabase, not a third-party headless CMS) letting the business owner edit homepage hero, story/heritage page, and footer pages (FAQ/shipping/returns) without touching code

### Security
- OTP-based two-factor admin login, rate-limited, backed by Redis (survives serverless cold starts/multi-instance issues that an in-memory approach would break under)
- bcrypt password hashing, security headers

### Marketing & customer communication
- Email template system with a visual builder (product picker, template selector) for campaigns
- Manual subscriber management with per-campaign recipient targeting
- In-app rich-text reply to customer contact messages, sent via Resend
- Per-product "inquire about this item" contact flow
- Product reviews system with admin moderation

## Notable engineering problems solved

- **Serverless-safe auth:** diagnosed and fixed an OTP "expired" bug caused by using an in-memory store that doesn't persist across serverless instances — moved to Redis.
- **CORS-safe currency conversion:** exchange-rate lookups were silently failing client-side (blocked by CORS) and falling back to stale hardcoded rates; proxied through a server-side route to fix live pricing display.
- **Zero-price product guard:** found and fixed a live bug where unpriced products could be added to cart and checked out for free; replaced with a real price/image completeness check and a clear "coming soon" state.

## Outcome

[ ] Add a real, confirmed outcome line once available — e.g. launch date, first real customer order, any metric the business owner is comfortable being quoted (traffic, conversion, time saved). Do not publish a number that hasn't been confirmed.

## Assets needed before publishing

- [ ] 3–5 real screenshots: homepage, product detail page, admin order detail (with card documents), CMS edit screen
- [ ] Confirm with the business owner what, if anything, should stay unpublished (internal admin views, exact revenue, etc.) before using screenshots publicly
- [ ] Optional: a short client quote/testimonial, if comfortable requesting one
