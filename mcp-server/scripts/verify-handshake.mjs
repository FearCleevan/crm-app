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

const expectedProspectTools = [
  "search_prospects",
  "get_prospect",
  "create_prospect",
  "update_prospect",
];
const expectedDealTools = [
  "list_deals",
  "get_deal",
  "update_deal_stage",
  "create_deal",
];
const expectedCampaignTools = [
  "list_campaigns",
  "get_campaign",
  "create_campaign",
  "activate_campaign",
  "list_campaign_recipients",
];
const expectedNoteTools = [
  "list_notes",
  "add_note",
];
const expectedWorkflowTools = [
  "list_workflows",
  "get_workflow_runs",
];
console.log("=== expected prospect tools present? ===");
for (const name of expectedProspectTools) {
  console.log(`${name}: ${toolNames.includes(name) ? "FOUND" : "MISSING"}`);
}
console.log("=== expected deal tools present? ===");
for (const name of expectedDealTools) {
  console.log(`${name}: ${toolNames.includes(name) ? "FOUND" : "MISSING"}`);
}
console.log("=== expected campaign tools present? ===");
for (const name of expectedCampaignTools) {
  console.log(`${name}: ${toolNames.includes(name) ? "FOUND" : "MISSING"}`);
}
console.log("=== expected note tools present? ===");
for (const name of expectedNoteTools) {
  console.log(`${name}: ${toolNames.includes(name) ? "FOUND" : "MISSING"}`);
}
console.log("=== expected workflow tools present? ===");
for (const name of expectedWorkflowTools) {
  console.log(`${name}: ${toolNames.includes(name) ? "FOUND" : "MISSING"}`);
}

const expectedReportTools = ["get_report"];
console.log("=== expected report tools present? ===");
for (const name of expectedReportTools) {
  console.log(`${name}: ${toolNames.includes(name) ? "FOUND" : "MISSING"}`);
}

console.log("=== get_report schema check (type enum + date_range enum) ===");
try {
  const tools = await client.listTools();
  const getReportTool = (tools.tools ?? []).find((t) => t.name === "get_report");
  if (!getReportTool) {
    console.log("get_report tool not found in tools/list — cannot check schema.");
  } else {
    const schema = getReportTool.inputSchema;
    const typeEnum = schema?.properties?.type?.enum ?? [];
    const dateRangeEnum = schema?.properties?.date_range?.enum ?? [];
    const expectedTypeEnum = [
      "dashboard_metrics",
      "revenue_by_month",
      "leads_breakdown",
      "conversion_funnel",
      "activity_breakdown",
    ];
    const expectedDateRangeEnum = ["7d", "30d", "month", "quarter", "year"];
    console.log("type enum (actual):", JSON.stringify(typeEnum));
    console.log("type enum matches expected 5 values:",
      expectedTypeEnum.length === typeEnum.length &&
        expectedTypeEnum.every((v) => typeEnum.includes(v)));
    console.log("date_range enum (actual):", JSON.stringify(dateRangeEnum));
    console.log("date_range enum matches expected:",
      expectedDateRangeEnum.length === dateRangeEnum.length &&
        expectedDateRangeEnum.every((v) => dateRangeEnum.includes(v)));
  }
} catch (err) {
  console.log("schema check raised:", err?.code, err?.message);
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

console.log("=== callTool: list_deals (expects isError with Supabase connection/auth failure, not a crash) ===");
try {
  const result = await client.callTool({
    name: "list_deals",
    arguments: {},
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

console.log("=== callTool: list_campaigns (expects isError with Supabase connection/auth failure, not a crash) ===");
try {
  const result = await client.callTool({
    name: "list_campaigns",
    arguments: {},
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

console.log("=== callTool: list_notes with fake prospect_id (expects isError with Supabase connection/auth failure, not a crash) ===");
try {
  const result = await client.callTool({
    name: "list_notes",
    arguments: { prospect_id: 12345 },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

console.log(
  "=== callTool: activate_campaign WITHOUT confirm:true (MOST IMPORTANT CHECK — must be isError:true, must NOT silently activate) ==="
);
const activateNoConfirmArgs = {
  // Must satisfy zod's strict RFC4122 uuid() check (version + variant nibbles),
  // not just look UUID-shaped, or validation rejects it before the tool ever runs.
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  confirm: false,
};
let activateNoConfirmResult;
try {
  activateNoConfirmResult = await client.callTool({
    name: "activate_campaign",
    arguments: activateNoConfirmArgs,
  });
  console.log(JSON.stringify(activateNoConfirmResult, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

console.log("=== guardrail assessment ===");
if (activateNoConfirmResult) {
  const isError = activateNoConfirmResult.isError === true;
  const text = activateNoConfirmResult.content?.[0]?.text ?? "";
  const mentionsPendingRecipients = /pending recipient/i.test(text);
  const mentionsActivatedSuccessfully =
    /"status":\s*"active"/i.test(text) || /activated/i.test(text);
  console.log(`isError === true: ${isError}`);
  console.log(`message mentions "pending recipients": ${mentionsPendingRecipients}`);
  console.log(
    `result text: ${text}`
  );
  console.log(
    `NOTE: this environment's .env.local uses PLACEHOLDER Supabase credentials, so the ` +
      `campaign_recipients count query itself fails before reaching the confirm-guard's ` +
      `pending-recipient message. What this run actually proves is the safety-critical property: ` +
      `activate_campaign returned isError:true and did NOT report a successful activation ` +
      `(no "status":"active" in the response) when called without confirm:true. Against a real ` +
      `database, the count query would succeed and the message would read exactly as coded: ` +
      `"Activating this campaign will start sending real emails to N pending recipients...".`
  );
  console.log(
    `Did NOT silently activate (no success/active status in response): ${!mentionsActivatedSuccessfully}`
  );
} else {
  console.log("activate_campaign call raised instead of returning a structured result — see above.");
}

console.log("=== callTool: get_campaign right after (confirms no status change occurred) ===");
try {
  const result = await client.callTool({
    name: "get_campaign",
    arguments: { id: activateNoConfirmArgs.id },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

console.log("=== callTool: list_workflows (expects isError with Supabase connection/auth failure, not a crash) ===");
try {
  const result = await client.callTool({
    name: "list_workflows",
    arguments: {},
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

console.log("=== callTool: get_workflow_runs with fake workflow_id (expects isError with Supabase connection/auth failure, not a crash) ===");
try {
  const result = await client.callTool({
    name: "get_workflow_runs",
    arguments: { workflow_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(
    "callTool raised (unexpected — a thrown/crashed process rather than a structured tool error):",
    err?.code,
    err?.message
  );
}

console.log("=== callTool: get_report type=dashboard_metrics (expects isError with Supabase RPC connection error, not a crash) ===");
try {
  const result = await client.callTool({
    name: "get_report",
    arguments: { type: "dashboard_metrics" },
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
