import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

// dist/index.js loads config via `dotenv/config`, which only reads `.env` by
// default. This repo's real config file is `.env.local` (gitignored), so we
// point dotenv at it explicitly via DOTENV_CONFIG_PATH when spawning the
// server, the same way `npm start` would need to in a real deployment.
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  env: {
    ...process.env,
    DOTENV_CONFIG_PATH: path.resolve(process.cwd(), ".env.local"),
  },
});

const client = new Client(
  { name: "verify-handshake-client", version: "0.0.1" },
  { capabilities: {} }
);

await client.connect(transport);

console.log("=== Server Info (from initialize handshake) ===");
console.log(JSON.stringify(client.getServerVersion(), null, 2));

console.log("=== tools/list result ===");
let toolNames = [];
try {
  const tools = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));
  toolNames = (tools.tools ?? []).map((t) => t.name);
} catch (err) {
  console.log(
    "tools/list raised:",
    err?.code,
    err?.message,
    "(expected: the SDK's McpServer only registers the tools/list request handler once a tool is added via server.tool(); with zero tools registered, this 'Method not found' is the correct, by-design equivalent of an empty tool set.)"
  );
}

const expectedTools = [
  "search_prospects",
  "get_prospect",
  "create_prospect",
  "update_prospect",
];
console.log("=== expected prospect tools present? ===");
for (const name of expectedTools) {
  console.log(`${name}: ${toolNames.includes(name) ? "FOUND" : "MISSING"}`);
}

console.log("=== callTool: search_prospects (expects isError with Supabase connection/auth failure, not a crash) ===");
try {
  const result = await client.callTool({
    name: "search_prospects",
    arguments: { query: "a", limit: 5 },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

await client.close();
process.exit(0);
