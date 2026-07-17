import type { z } from 'npm:zod@4'

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

export interface ToolDef {
  name: string
  description: string
  schema: Record<string, z.ZodTypeAny>
  handler: (args: any) => Promise<ToolResult>
}
