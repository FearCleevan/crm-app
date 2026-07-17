import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FUNCTION_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_URL = 'http://localhost:8000'
const TEST_TOKEN = 'test-token-123'

const env = {
  ...process.env,
  CRM_MCP_TOKEN: TEST_TOKEN,
  SUPABASE_URL: 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-key',
  MCP_CRM_USER_ID: '00000000-0000-0000-0000-000000000000',
}

const proc = spawn('npx', ['deno', 'run', '--allow-net', '--allow-env', 'index.ts'], {
  cwd: FUNCTION_DIR,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
})

proc.stderr.on('data', (d) => process.stderr.write(d))

async function waitForReady(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE_URL, { method: 'OPTIONS' })
      if (res.status === 200) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Server did not become ready in time')
}

async function rpc(method, params, id = 1, token = TEST_TOKEN) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function main() {
  await waitForReady()

  console.log('=== No auth header (expect 401) ===')
  const noAuthRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  })
  console.log('status:', noAuthRes.status)
  if (noAuthRes.status !== 401) throw new Error('expected 401 with no auth header')

  console.log('=== Wrong token (expect 401) ===')
  const wrongRes = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  })
  console.log('status:', wrongRes.status)
  if (wrongRes.status !== 401) throw new Error('expected 401 with wrong token')

  console.log('=== initialize (expect 200, serverInfo) ===')
  const init = await rpc('initialize', { protocolVersion: '2025-06-18' })
  console.log(JSON.stringify(init, null, 2))
  if (init.body?.result?.serverInfo?.name !== 'crm-mcp') throw new Error('unexpected serverInfo')

  console.log('=== tools/list (expect empty array at this stage) ===')
  const list = await rpc('tools/list', {}, 2)
  console.log(JSON.stringify(list.body.result.tools, null, 2))

  console.log('=== tools/list (expect 4 prospect tools) ===')
  const list2 = await rpc('tools/list', {}, 3)
  const names = list2.body.result.tools.map((t) => t.name)
  console.log(names)
  for (const expected of ['search_prospects', 'get_prospect', 'create_prospect', 'update_prospect']) {
    if (!names.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: search_prospects (expect isError, placeholder credentials) ===')
  const callRes = await rpc(
    'tools/call',
    { name: 'search_prospects', arguments: { query: 'a', limit: 5 } },
    4,
  )
  console.log(JSON.stringify(callRes.body, null, 2))
  if (callRes.body?.result?.isError !== true) throw new Error('expected isError:true from search_prospects')

  console.log('ALL CHECKS PASSED')
  proc.kill()
  process.exit(0)
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  proc.kill()
  process.exit(1)
})
