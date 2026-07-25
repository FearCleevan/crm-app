# Signal Theme — Phase 1 (Token Rewrite) — Design

## Problem

The app's current light/dark theme is the generic "navy-black + violet" look common to
AI-generated dashboards — flagged in an earlier design critique (no signature element, one
accent color doing every job, cold navy background the user explicitly dislikes). A palette
comparison artifact was built showing three candidate directions in both light and dark
(Ember/Signal/Field); the user chose **Signal** — true-neutral graphite in dark mode, true-neutral
white in light mode (neither has a blue undertone, so it can't drift back toward "navy"), with a
single restrained cyan accent.

## Decision

This is **Phase 1 of a two-phase rollout**, scoped deliberately small:

- **Phase 1 (this spec):** rewrite the existing semantic CSS custom properties in
  `src/styles/globals.css` to Signal's values. One file, no component changes, low risk, recolors
  the large majority of visible chrome (backgrounds, cards, borders, sidebar, buttons, focus
  rings) because the app already consumes color exclusively through these tokens in its layout
  chrome.
- **Phase 2 (separate spec, not started):** audit 67 files that use literal Tailwind palette
  classes (e.g. `text-green-500`, `bg-blue-600`) outside the token system — mostly legitimate
  status/semantic colors (deal stages, campaign health, chart series) that should stay independent
  of the brand accent, but some may be standing in for "brand" where they should migrate to the
  new tokens instead. That requires real per-file judgment and is out of scope here.

**Execution note:** per the user's explicit preference, implementation stops after Phase 1 for
confirmation before any Phase 2 work begins — same stop-gate pattern already used for every task
in this project's subagent-driven-development plans.

## Architecture

Only `src/styles/globals.css` changes: its `:root` block (light theme) and `.dark` block (dark
theme) each get their HSL custom-property values replaced. `tailwind.config.js` needs no edit —
it already maps every token generically via `hsl(var(--x))`, so it has no hardcoded color values
of its own to update. `src/context/ThemeContext.tsx` (the light/dark toggle mechanism, class-based
`dark` on `<html>`) is untouched — this is a values-only swap, not an architecture change.

One new token pair is introduced: `--positive` / `--positive-foreground`, mirroring how
`--destructive` / `--destructive-foreground` already works, so status-positive UI (stat deltas,
"active"-style badges) has a proper themeable token to eventually migrate to in Phase 2 — Phase 1
only *defines* it; migrating today's ad-hoc green Tailwind classes onto it is Phase 2 work.

## Token Mapping

Hex is the source of truth below; the plan converts each to an HSL triplet programmatically
(e.g. via a short Node one-liner using the same H/S/L formula `globals.css` already uses), not by
hand, to avoid transcription drift across ~30 values.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--background` | `#F7F7F8` | `#121214` | true neutral, no blue undertone in either mode |
| `--foreground` | `#17171A` | `#EDEDEF` | |
| `--card`, `--popover`, `--surface` | `#FFFFFF` | `#1C1C1F` | |
| `--card-foreground`, `--popover-foreground` | `#17171A` | `#EDEDEF` | same as `--foreground` |
| `--muted-foreground` | `#6B6B72` | `#8F8F96` | |
| `--border`, `--input` | `#E1E1E4` | `#2A2A2E` | |
| `--primary`, `--ring`, `--brand-500` | `#0E8FA3` | `#2FD1E0` | the Signal accent — deepened on light for contrast, matches the comparison artifact exactly |
| `--primary-foreground` | `#F2FBFC` | `#0A1618` | text/icon color placed *on* the accent |
| `--positive` *(new)* | `#268A49` | `#5FBF7A` | mirrors `--destructive`'s existing pattern |
| `--positive-foreground` *(new)* | `#F2FBF5` | `#0B1A0F` | text/icon color placed on `--positive` |
| `--secondary`, `--accent` | = `--muted` (see below) | = `--muted` (see below) | matches the current file's existing convention of aliasing these to the muted tier — **`--accent` here is the generic hover-neutral token, unrelated to "the Signal accent," which is `--primary`/`--brand-500` above; this naming collision already exists in the codebase and isn't being fixed in this pass** |
| `--muted` | `#EFEFF1` | `#19191C` | already-decided values — these are exactly the chip-background hexes used in the approved comparison artifact's Signal panels, not new invented values |
| `--destructive`, `--destructive-foreground` | **unchanged** | **unchanged** | semantic error red, independent of brand accent — not part of this rebrand |
| `--brand-50…900` | 10-step ramp from `#0E8FA3` | 10-step ramp from `#2FD1E0` | see ramp rule below — replaces the current violet ramp |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-border` | derived from `--card`/`--foreground`/`--border` above | same | no separate hue — sidebar is not visually distinguished by color in the current design either |
| `--sidebar-accent`, `--sidebar-accent-foreground` | light tint of `--primary` / `--primary` | dark tint of `--primary` / `--primary` | active nav-item styling, follows the accent |
| `--surface-raised`, `--surface-overlay` | slight lightness offsets from `--card`, same relative offsets the current file already uses (just recentered on the new neutral) | same | |
| `--radius` | unchanged | unchanged | not a color, not in scope |

**`--brand-50…900` ramp rule** (concrete, not left to implementer discretion): convert the new
accent hex to HSL and keep its H and S fixed across all 10 steps in that theme — only L varies.
`--brand-500` uses the accent's own computed L exactly. The other 9 steps reuse the *lightness
percentages the current file already has at each position* (light mode goes light→dark from 50→900,
e.g. current `--brand-50` L 97% down to `--brand-900` L 24%; dark mode goes dark→light from 50→900,
e.g. current `--brand-50` L 15% up to `--brand-900` L 94% — this direction is deliberately inverted
between themes in the existing file and must stay inverted, so higher-numbered steps stay visible
against a dark base). Only H and S change to the new accent's; every L percentage at every step
index is copied verbatim from today's file.

## Testing

No automated styling tests exist in this app (matches project convention — verification here is
visual, same as every other UI change in this codebase). Verification for this phase:

- `npx tsc -b` — confirms nothing broke (this is a CSS-only change, so this mainly guards against
  an accidental syntax slip if the plan's steps touch anything beyond `globals.css`).
- Manual check in a running dev server: toggle light → dark → light, confirm the toggle still
  works and persists (localStorage `crm-theme`, unchanged mechanism); visually check Dashboard,
  Sidebar, Login page, and Emails/Templates in both themes; confirm no leftover violet anywhere
  that's driven by a token (stray-color files are explicitly Phase 2, expected to still show old
  colors after this phase).

## Out of scope

- The 67-file stray-color audit (Phase 2, separate spec).
- Any component file changes — this phase is `globals.css` only.
- Migrating existing ad-hoc green/red status colors onto the new `--positive`/`--destructive`
  tokens — Phase 1 only defines `--positive`, doesn't migrate consumers onto it.
- Typography, spacing, iconography, or layout changes — this is a color-token pass only, per the
  original critique's narrower ask ("what can you suggest for the navy-black thing").
