import type { ToolDef } from './types.ts'
import { prospectTools } from './prospects.ts'
import { dealTools } from './deals.ts'
import { campaignTools } from './campaigns.ts'
import { noteTools } from './notes.ts'

export const TOOLS: ToolDef[] = [...prospectTools, ...dealTools, ...campaignTools, ...noteTools]
