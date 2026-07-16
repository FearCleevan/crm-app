import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export const server = new McpServer({
  name: 'crm-mcp-server',
  version: '0.1.0',
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[crm-mcp-server] fatal error:', err)
    process.exit(1)
  })
}
