# Signal Theme — Phase 1 (Token Rewrite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor the app's light and dark themes to the Signal palette by rewriting the semantic CSS custom properties in `src/styles/globals.css` — one file, no component changes.

**Architecture:** The app already themes exclusively through HSL CSS custom properties (`:root` for light, `.dark` for dark), consumed generically by `tailwind.config.js` via `hsl(var(--x))`. This plan derives every new HSL triplet from Signal's hex values using a throwaway Node script (standard RGB→HSL conversion), so no value is hand-computed, then replaces the `:root`/`.dark` blocks with the derived values.

**Tech Stack:** Plain CSS custom properties, Node (for the one-off conversion script — no new dependency, uses only built-ins).

## Global Constraints

- Hex values are the source of truth (from the spec's token table); HSL triplets must come from running a script, never hand-computed.
- `--destructive` / `--destructive-foreground` stay **completely unchanged** in both `:root` and `.dark` — not part of this rebrand.
- `--radius` stays unchanged — not a color, not in scope.
- The `--brand-50…900` ramp keeps the new accent's H and S constant across all 10 steps; only L varies. `--brand-500`'s L is the accent's own computed L. Every other step's L is copied verbatim from the *current* file at that same step index — light: `50→97, 100→93, 200→87, 300→78, 400→68, 600→45, 700→37, 800→30, 900→24`; dark: `50→15, 100→20, 200→27, 300→37, 400→52, 600→75, 700→82, 800→88, 900→94`. This preserves the existing file's deliberately-inverted light/dark ramp direction (light goes light→dark as the step number increases; dark goes dark→light).
- No component files change in this phase — only `src/styles/globals.css`.
- No automated styling tests exist in this app (matches project convention) — verification is `npx tsc -b` plus a manual visual check in a running dev server, since "does this look like Signal" isn't something a script can assert.

---

### Task 1: Rewrite `globals.css`'s theme tokens to Signal

**Files:**

- Create (temporary, deleted before commit): `scripts/tmp-signal-hsl.mjs`
- Modify: `src/styles/globals.css`

**Interfaces:**

- Consumes: nothing from other tasks — this is the only task in this phase.
- Produces: new HSL values for every token below, in both `:root` and `.dark`. No new file, class, or component interface is created — Phase 2 (a separate, not-yet-written plan) will consume these same token *names* (unchanged) when it migrates the 67 stray-color files onto `--positive` and friends.

- [ ] **Step 1: Write the HSL conversion script**

Create `scripts/tmp-signal-hsl.mjs` (at the `crm-app` project root, alongside the existing `scripts/` directory used by `verify-middleware.mjs`):

```javascript
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s
  const l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function fmt(hsl) {
  return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`
}

function withL(hsl, l) {
  return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(l)}%`
}

const LIGHT_RAMP_L = [97, 93, 87, 78, 68, 51, 45, 37, 30, 24]
const DARK_RAMP_L  = [15, 20, 27, 37, 52, 68, 75, 82, 88, 94]
const RAMP_STEPS   = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

function printTheme(name, hex) {
  const bg = hexToHsl(hex.background)
  const fg = hexToHsl(hex.foreground)
  const card = hexToHsl(hex.card)
  const cardFg = hexToHsl(hex.cardForeground)
  const mutedFg = hexToHsl(hex.mutedForeground)
  const border = hexToHsl(hex.border)
  const primary = hexToHsl(hex.primary)
  const primaryFg = hexToHsl(hex.primaryForeground)
  const positive = hexToHsl(hex.positive)
  const positiveFg = hexToHsl(hex.positiveForeground)
  const muted = hexToHsl(hex.muted)

  console.log(`\n/* ── ${name} ── */`)
  console.log(`--background: ${fmt(bg)};`)
  console.log(`--foreground: ${fmt(fg)};`)
  console.log(`--card: ${fmt(card)};`)
  console.log(`--card-foreground: ${fmt(cardFg)};`)
  console.log(`--popover: ${fmt(card)};`)
  console.log(`--popover-foreground: ${fmt(cardFg)};`)
  console.log(`--primary: ${fmt(primary)};`)
  console.log(`--primary-foreground: ${fmt(primaryFg)};`)
  console.log(`--secondary: ${fmt(muted)};`)
  console.log(`--secondary-foreground: ${fmt(fg)};`)
  console.log(`--muted: ${fmt(muted)};`)
  console.log(`--muted-foreground: ${fmt(mutedFg)};`)
  console.log(`--accent: ${fmt(muted)};`)
  console.log(`--accent-foreground: ${fmt(fg)};`)
  console.log(`--positive: ${fmt(positive)};`)
  console.log(`--positive-foreground: ${fmt(positiveFg)};`)
  console.log(`--border: ${fmt(border)};`)
  console.log(`--input: ${fmt(border)};`)
  console.log(`--ring: ${fmt(primary)};`)
  console.log(`--surface: ${fmt(card)};`)

  const raisedL = card.l + (name === 'DARK' ? 3 : -2)
  const overlayL = card.l + (name === 'DARK' ? 2 : 0)
  console.log(`--surface-raised: ${withL(card, raisedL)};`)
  console.log(`--surface-overlay: ${withL(card, overlayL)};`)

  const ramp = name === 'DARK' ? DARK_RAMP_L : LIGHT_RAMP_L
  RAMP_STEPS.forEach((step, i) => {
    const l = step === 500 ? primary.l : ramp[i]
    console.log(`--brand-${step}: ${withL(primary, l)};`)
  })

  console.log(`--sidebar: ${fmt(bg)};`)
  console.log(`--sidebar-foreground: ${fmt(fg)};`)
  console.log(`--sidebar-border: ${fmt(border)};`)
  console.log(`--sidebar-accent: ${withL(primary, ramp[0])};`)
  console.log(`--sidebar-accent-foreground: ${withL(primary, ramp[6])};`)
}

printTheme('LIGHT', {
  background: '#F7F7F8', foreground: '#17171A',
  card: '#FFFFFF', cardForeground: '#17171A',
  mutedForeground: '#6B6B72', border: '#E1E1E4',
  primary: '#0E8FA3', primaryForeground: '#F2FBFC',
  positive: '#268A49', positiveForeground: '#F2FBF5',
  muted: '#EFEFF1',
})

printTheme('DARK', {
  background: '#121214', foreground: '#EDEDEF',
  card: '#1C1C1F', cardForeground: '#EDEDEF',
  mutedForeground: '#8F8F96', border: '#2A2A2E',
  primary: '#2FD1E0', primaryForeground: '#0A1618',
  positive: '#5FBF7A', positiveForeground: '#0B1A0F',
  muted: '#19191C',
})
```

- [ ] **Step 2: Run the script and capture its output**

Run (from `crm-app/`): `node scripts/tmp-signal-hsl.mjs`

Expected: two blocks of ready-to-paste `--token: H S% L%;` lines, headed `/* ── LIGHT ── */` and `/* ── DARK ── */`. Keep this output visible — Step 3 copies values directly from it. Do not hand-edit or re-derive any of these numbers; if a value looks surprising, re-check the script's input hex against the Global Constraints table above rather than adjusting the printed HSL by hand.

- [ ] **Step 3: Replace the `:root` block in `globals.css`**

Open `src/styles/globals.css`. In the `:root { ... }` block (light theme, currently starting with `--background: 0 0% 98%;`), replace the value of every one of these properties with the corresponding line from the script's `LIGHT` output: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--border`, `--input`, `--ring`, `--surface`, `--surface-raised`, `--surface-overlay`, all ten `--brand-*` steps, `--sidebar`, `--sidebar-foreground`, `--sidebar-border`, `--sidebar-accent`, `--sidebar-accent-foreground`.

Add two new lines for the new tokens (values from the script's `LIGHT` output): `--positive` and `--positive-foreground`, placed next to `--destructive`/`--destructive-foreground` for readability.

Leave exactly two lines in this block untouched: `--destructive: 0 84% 60%;` and `--destructive-foreground: 0 0% 100%;`. Leave `--radius: 0.5rem;` untouched.

- [ ] **Step 4: Replace the `.dark` block in `globals.css`**

Same substitution as Step 3, but in the `.dark { ... }` block, using the script's `DARK` output. Leave `--destructive: 0 72% 51%;` and `--destructive-foreground: 0 0% 100%;` untouched (this block has no `--radius` — that property only lives in `:root` and cascades).

- [ ] **Step 5: Delete the temporary script**

```bash
rm scripts/tmp-signal-hsl.mjs
```

It was a one-off value-generation aid, not app code — nothing should reference it, and it shouldn't be committed.

- [ ] **Step 6: Type-check**

Run (from `crm-app/`): `npx tsc -b`
Expected: no output, exit code 0. (This change is CSS-only; this step is a guard against an accidental slip, not an expected source of errors.)

- [ ] **Step 7: Manual visual verification**

Run: `npm run dev`, open the printed local URL.

- Toggle light → dark → light using the theme toggle in the top bar; confirm it still works and the choice persists across a page reload (stored in `localStorage` under `crm-theme`, mechanism unchanged by this plan).
- In both themes, check: Dashboard, Sidebar (including the active nav item's highlight), Login page, and Emails → Templates.
- Confirm: no navy-blue or violet remains anywhere driven by a token (stray Tailwind-class colors in the 67 files noted in the spec are explicitly out of scope for this phase and are expected to still show old colors).
- Confirm both themes are legible (text readable against its background, no near-invisible borders).

- [ ] **Step 8: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: recolor theme tokens to the Signal palette (Phase 1)"
```

---

## Post-merge: deploy & verify (after this is merged to `main`)

This frontend deploys via Vercel's GitHub push trigger — there is no manual Dashboard paste step
like the Supabase Edge Functions in other recent plans.

1. `git push origin main`.
2. Poll `https://api.github.com/repos/FearCleevan/crm-app/commits/<sha>/status` until the Vercel
   check resolves — don't assume success from the push alone; this exact class of change (a normal
   frontend commit) has deployed cleanly twice already this session, but confirm the commit status
   itself before telling the user it's live, same as both prior deploys today.
3. Load `https://crm.peterpaullazan.com` and spot-check the same pages as Step 7 on the real
   deployment.

**Per the user's explicit preference: stop here and get confirmation before starting Phase 2** (the
67-file stray-color audit) — Phase 2 has no spec or plan yet.
