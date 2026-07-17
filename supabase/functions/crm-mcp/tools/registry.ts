import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'

export const TOOLS: ToolDef[] = [...prospectTools, ...dealTools]
