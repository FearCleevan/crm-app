// Canonical merge-field list for the FRONTEND only.
// Deliberately NOT shared across the Deno/MCP runtime boundary — these copies
// must be updated by hand if this list changes:
//   supabase/functions/send-campaign-batch/index.ts       (resolveVars, 8 tokens, currently correct)
//   supabase/functions/crm-mcp/tools/templateVariables.ts (7 tokens — missing full_name, known gap)
//   supabase/functions/crm-mcp/DEPLOY_BUNDLE.ts            (mirror of the file above)
export const MERGE_FIELDS = [
  { key: 'first_name',   label: 'First Name'   },
  { key: 'last_name',    label: 'Last Name'    },
  { key: 'full_name',    label: 'Full Name'    },
  { key: 'company',      label: 'Company'      },
  { key: 'job_title',    label: 'Job Title'    },
  { key: 'website',      label: 'Website'      },
  { key: 'my_name',      label: 'My Name'      },
  { key: 'my_portfolio', label: 'My Portfolio' },
] as const

export type MergeFieldKey = typeof MERGE_FIELDS[number]['key']

export function resolveMergeFields(
  text: string,
  values: Partial<Record<MergeFieldKey, string>>,
): string {
  let result = text
  for (const { key } of MERGE_FIELDS) {
    result = result.split(`{{${key}}}`).join(values[key] ?? '')
  }
  return result
}
