import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerProspectTools } from './tools/prospects.js'
import { registerDealTools } from './tools/deals.js'
import { registerCampaignTools } from './tools/campaigns.js'

export const server = new McpServer({
  name: 'crm-mcp-server',
  version: '0.1.0',
})

registerProspectTools(server)
registerDealTools(server)
registerCampaignTools(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Use pathToFileURL for a platform-correct comparison — on Windows,
// `file://${process.argv[1]}` (backslashes, missing drive-letter slash)
// never equals import.meta.url, so this guard previously never matched
// and main() never ran.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error('[crm-mcp-server] fatal error:', err)
    process.exit(1)
  })
}
