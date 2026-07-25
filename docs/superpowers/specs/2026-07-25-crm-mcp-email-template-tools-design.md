# crm-mcp Email Template Tools — Design

## Problem

`crm-mcp` (the claude.ai Custom Connector) has 19 tools covering prospects, deals, campaigns,
notes, workflows, reports, and outreach. Campaign creation (`create_campaign`) accepts an
optional `template_id`, but there is no way for Claude to actually create or discover a template
in the first place — that write path only exists in the CRM's own frontend
(`src/services/templateService.ts`). Claude can *use* a template but not *write* one, which
blocks a natural workflow: asking Claude to draft and save a reusable outreach template directly
from a claude.ai chat.

## Decision

Add two new tools, `create_email_template` and `list_email_templates`, to
`supabase/functions/crm-mcp/tools/campaigns.ts` (templates are campaign-adjacent; not a large
enough surface to justify a new file), following the exact pattern every other tool in this file
already uses. Mirror the same change into `DEPLOY_BUNDLE.ts`, per this project's established
paste-deploy convention. **v2 (claude.ai connector) only** — the local Claude Code MCP server
(v1, `mcp-server/`) does not get these tools in this pass.

Scope is deliberately minimal: create + list only, no get/update/delete. `get_campaign` already
surfaces a template's `name`/`subject` when viewing a campaign; a dedicated read tool for full
template bodies can be added later if that turns out to matter.

## Data Model (existing, unchanged)

`email_templates` (from `crm-schema.sql`, extended by migration `004_extend_email_templates.sql`):

```sql
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category = ANY (ARRAY[
    'general','follow_up','introduction','proposal','closing',
    're_engagement','newsletter','cold_outreach','no_website','outdated_website'
  ])),
  subject text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES public.crm_users(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (id)
);
```

The 7 known merge-field tokens (from `src/components/emails/VariableChips.tsx`'s
`TEMPLATE_VARIABLES`, the source of truth for what the compose UI recognizes):

```text
{{first_name}}  {{last_name}}  {{company}}  {{job_title}}  {{website}}  {{my_name}}  {{my_portfolio}}
```

## Tool 1: `create_email_template`

**Schema:**

```typescript
{
  name: z.string().min(1),
  category: z.enum([
    'general', 'follow_up', 'introduction', 'proposal', 'closing',
    're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
  ]).default('general'),
  subject: z.string().min(1),
  body: z.string().min(1),
}
```

**Behavior:**

- Requires `MCP_CRM_USER_ID` to be configured (same guard as `create_campaign`/`add_note`) — if
  unset, return a structured error naming the missing secret, don't insert anything.
- `variables` is computed server-side, not accepted as an argument: scan `body` for each of the 7
  known `{{...}}` tokens (exact substring match against the fixed list above, not a generic
  `{{...}}` regex — an unrecognized placeholder like `{{foo}}` is left as literal text in the body
  and is NOT added to `variables`, matching what the compose UI itself would recognize) and store
  the subset that appears, in the fixed list's order.
- Insert with `created_by: MCP_CRM_USER_ID`, `is_active: true` (matches `templateService.createTemplate`'s
  default).
- No `confirm` guard — creating a template persists content but sends nothing; it only becomes
  outbound when a campaign referencing it is later activated (`activate_campaign`, which already
  has its own confirm gate). Matches `create_campaign`/`create_prospect`/`create_deal`, none of
  which are guarded.
- Returns: `id, name, category, subject, variables, created_at`.

**Example:** Claude writes a cold-outreach template with `body` containing `{{first_name}}` and
`{{company}}` → the tool stores `variables: ["{{first_name}}", "{{company}}"]` automatically.

## Tool 2: `list_email_templates`

**Schema:**

```typescript
{
  category: z.enum([
    'general', 'follow_up', 'introduction', 'proposal', 'closing',
    're_engagement', 'newsletter', 'cold_outreach', 'no_website', 'outdated_website',
  ]).optional(),
}
```

**Behavior:**

- Filters `is_active = true` only. Deliberately **not** filtered by `created_by` — this differs
  from `templateService.getTemplates(createdBy)` (which is scoped to the logged-in frontend
  user), because `list_campaigns`/`list_deals`/`list_notes` in this same file already show the
  whole shared CRM dataset regardless of who created each row, and there's no reason templates
  should be the one resource Claude can't see teammates' copies of.
- If `category` is supplied, adds an `.eq('category', category)` filter.
- Ordered by `created_at desc`, matching the frontend's own ordering.
- Returns: `id, name, category, subject, variables, created_at` per row — **not** `body`, to keep
  a list response scannable when there are many templates; `subject` alone is usually enough for
  Claude to judge relevance before deciding whether to reference a template by id in
  `create_campaign`.

## Security

Both tools sit behind `crm-mcp`'s existing bearer-token `checkAuth` gate (unchanged) — no new
auth surface. `create_email_template` writes to a table with no downstream side effect until a
human (or Claude, later) explicitly activates a campaign using it; the guard that actually matters
(`activate_campaign`'s `confirm: true`) is untouched by this change.

## Testing

The variable-extraction logic is pure (string in, string array out, no I/O) and must be factored
out as its own exported function, `extractTemplateVariables(body: string): string[]`, specifically
so it can be tested directly without a live Supabase call — this is a plan requirement, not left
to implementer discretion.

Extend `supabase/functions/crm-mcp/scripts/verify-http.mjs` (the existing pattern — spawns the
function locally via `npx deno run` against placeholder credentials, no real database) with:

- `tools/list` now reports 21 tools (19 + these 2); assert both new names appear.
- `tools/call: create_email_template` with a `body` containing `{{first_name}}` and `{{company}}`
  plus one unrecognized `{{foo}}` — expect `isError: true` (placeholder Supabase credentials, same
  as every other DB-touching tool in this harness), confirming the tool is wired into the registry
  and its schema accepts the call.
- `tools/call: list_email_templates` — same `isError: true` placeholder-credentials pattern.
- A separate, narrower script or inline check (implementation's choice of harness, e.g.
  `scripts/verify-template-variables.mjs` importing `extractTemplateVariables` directly) asserting:
  `{{first_name}} at {{company}}` → `["{{first_name}}", "{{company}}"]`; a body with no known
  tokens → `[]`; a body containing `{{foo}}` (unrecognized) → `[]`, not `["{{foo}}"]`; a body
  containing all 7 tokens in reverse order → returned in the fixed list's order, not body order
  (per the Decision section).

## Out of scope

- `get_email_template` / `update_email_template` / delete — deferred, see Decision.
- v1 (local Claude Code MCP server) parity — deferred, see Decision.
- Any change to the frontend template UI, `templateService.ts`, or the `email_templates` schema —
  this only adds two read/write entry points against the existing table.
