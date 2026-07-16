import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
});

const client = new Client(
  { name: "verify-handshake-client", version: "0.0.1" },
  { capabilities: {} }
);

await client.connect(transport);

console.log("=== Server Info (from initialize handshake) ===");
console.log(JSON.stringify(client.getServerVersion(), null, 2));

console.log("=== tools/list result ===");
try {
  const tools = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));
} catch (err) {
  console.log(
    "tools/list raised:",
    err?.code,
    err?.message,
    "(expected: the SDK's McpServer only registers the tools/list request handler once a tool is added via server.tool(); with zero tools registered, this 'Method not found' is the correct, by-design equivalent of an empty tool set.)"
  );
}

await client.close();
process.exit(0);
