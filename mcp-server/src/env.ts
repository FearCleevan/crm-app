import { config as loadDotenv } from 'dotenv'
import { fileURLToPath } from 'node:url'

// Load .env.local explicitly, resolved relative to this module's own location
// (not process.cwd()) so the server works regardless of the directory it's
// launched from — e.g. when registered via `claude mcp add crm -- node
// crm-app/mcp-server/dist/index.js`, which sets no cwd and no
// DOTENV_CONFIG_PATH. Plain `dotenv/config` only reads `.env` from cwd by
// default, which is never true in that real launch path.
// This file lives at mcp-server/src/env.ts and compiles to
// mcp-server/dist/env.js, so `.env.local` (mcp-server/.env.local) is one
// directory up from the compiled file.
//
// This MUST live in its own module and be the first import in index.ts.
// ES module imports are hoisted and evaluated in declaration order before any
// other top-level statement runs, so a loadDotenv() call written inline in
// index.ts (even as its very first line) would still execute *after* every
// imported module (including ../supabaseClient.js, which reads
// process.env.SUPABASE_URL at module-evaluation time) had already run.
// Putting the side effect inside its own imported module makes it part of
// the import-evaluation order instead, so it genuinely runs first.
loadDotenv({ path: fileURLToPath(new URL('../.env.local', import.meta.url)) })
