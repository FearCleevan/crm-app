import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash, randomBytes } from 'node:crypto'

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
delete env.MCP_PUBLIC_URL

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
  const wwwAuth = noAuthRes.headers.get('www-authenticate')
  console.log('WWW-Authenticate:', wwwAuth)
  if (!wwwAuth || !wwwAuth.includes('resource_metadata=')) {
    throw new Error('expected WWW-Authenticate header with resource_metadata on 401')
  }

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

  console.log('=== tools/list (expect 8 tools: 4 prospect + 4 deal) ===')
  const list3 = await rpc('tools/list', {}, 5)
  const names2 = list3.body.result.tools.map((t) => t.name)
  console.log(names2)
  for (const expected of ['list_deals', 'get_deal', 'update_deal_stage', 'create_deal']) {
    if (!names2.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: list_deals (expect isError, placeholder credentials) ===')
  const dealsCall = await rpc('tools/call', { name: 'list_deals', arguments: {} }, 6)
  console.log(JSON.stringify(dealsCall.body, null, 2))
  if (dealsCall.body?.result?.isError !== true) throw new Error('expected isError:true from list_deals')

  console.log('=== tools/list (expect 15 tools: 4 prospect + 4 deal + 5 campaign + 2 template) ===')
  const list4 = await rpc('tools/list', {}, 7)
  const names3 = list4.body.result.tools.map((t) => t.name)
  console.log(names3)
  for (const expected of [
    'list_campaigns', 'get_campaign', 'create_campaign', 'activate_campaign', 'list_campaign_recipients',
    'create_email_template', 'list_email_templates',
  ]) {
    if (!names3.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: activate_campaign WITHOUT confirm (MOST IMPORTANT CHECK) ===')
  const noConfirm = await rpc(
    'tools/call',
    { name: 'activate_campaign', arguments: { id: '00000000-0000-0000-0000-000000000000', confirm: false } },
    8,
  )
  console.log(JSON.stringify(noConfirm.body, null, 2))
  if (noConfirm.body?.result?.isError !== true) throw new Error('activate_campaign without confirm did not return isError:true')
  if (JSON.stringify(noConfirm.body).includes('"status":"active"')) {
    throw new Error('activate_campaign without confirm appears to have activated something')
  }

  console.log('=== tools/call: create_email_template (expect isError, placeholder credentials) ===')
  const templateCall = await rpc(
    'tools/call',
    {
      name: 'create_email_template',
      arguments: {
        name: 'Cold Outreach Intro',
        subject: 'Quick question, {{first_name}}',
        body: 'Hi {{first_name}}, I noticed {{company}} might benefit from...',
      },
    },
    17,
  )
  console.log(JSON.stringify(templateCall.body, null, 2))
  if (templateCall.body?.result?.isError !== true) {
    throw new Error('expected isError:true from create_email_template')
  }

  console.log('=== tools/call: list_email_templates (expect isError, placeholder credentials) ===')
  const templatesListCall = await rpc('tools/call', { name: 'list_email_templates', arguments: {} }, 18)
  console.log(JSON.stringify(templatesListCall.body, null, 2))
  if (templatesListCall.body?.result?.isError !== true) {
    throw new Error('expected isError:true from list_email_templates')
  }

  console.log('=== tools/list (expect 17 tools: 4 prospect + 4 deal + 5 campaign + 2 template + 2 note) ===')
  const list5 = await rpc('tools/list', {}, 9)
  const names4 = list5.body.result.tools.map((t) => t.name)
  console.log(names4)
  for (const expected of ['list_notes', 'add_note']) {
    if (!names4.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: list_notes (expect isError, placeholder credentials) ===')
  const notesCall = await rpc('tools/call', { name: 'list_notes', arguments: { prospect_id: 1 } }, 10)
  console.log(JSON.stringify(notesCall.body, null, 2))
  if (notesCall.body?.result?.isError !== true) throw new Error('expected isError:true from list_notes')

  console.log('=== tools/list (expect 19 tools: 4 prospect + 4 deal + 5 campaign + 2 template + 2 note + 2 workflow) ===')
  const list6 = await rpc('tools/list', {}, 11)
  const names5 = list6.body.result.tools.map((t) => t.name)
  console.log(names5)
  for (const expected of ['list_workflows', 'get_workflow_runs']) {
    if (!names5.includes(expected)) throw new Error(`missing tool: ${expected}`)
  }

  console.log('=== tools/call: list_workflows (expect isError, placeholder credentials) ===')
  const workflowsCall = await rpc('tools/call', { name: 'list_workflows', arguments: {} }, 12)
  console.log(JSON.stringify(workflowsCall.body, null, 2))
  if (workflowsCall.body?.result?.isError !== true) throw new Error('expected isError:true from list_workflows')

  console.log('=== tools/list (expect 20 tools: 4 prospect + 4 deal + 5 campaign + 2 template + 2 note + 2 workflow + 1 report) ===')
  const list7 = await rpc('tools/list', {}, 13)
  const names6 = list7.body.result.tools.map((t) => t.name)
  console.log(names6)
  if (!names6.includes('get_report')) throw new Error('missing tool: get_report')

  console.log('=== tools/call: get_report type=dashboard_metrics (expect isError, placeholder credentials) ===')
  const reportCall = await rpc(
    'tools/call',
    { name: 'get_report', arguments: { type: 'dashboard_metrics' } },
    14,
  )
  console.log(JSON.stringify(reportCall.body, null, 2))
  if (reportCall.body?.result?.isError !== true) throw new Error('expected isError:true from get_report')

  console.log('=== tools/list (expect 21 tools: 4 prospect + 4 deal + 5 campaign + 2 template + 2 note + 2 workflow + 1 report + 1 outreach) ===')
  const list8 = await rpc('tools/list', {}, 15)
  const names7 = list8.body.result.tools.map((t) => t.name)
  console.log(names7)
  if (!names7.includes('send_outreach_email')) throw new Error('missing tool: send_outreach_email')

  console.log('=== tools/call: send_outreach_email WITHOUT confirm (MOST IMPORTANT CHECK) ===')
  const noConfirmEmail = await rpc(
    'tools/call',
    { name: 'send_outreach_email', arguments: { prospect_id: 1, subject: 'test', body: 'test', confirm: false } },
    16,
  )
  console.log(JSON.stringify(noConfirmEmail.body, null, 2))
  if (noConfirmEmail.body?.result?.isError !== true) {
    throw new Error('send_outreach_email without confirm did not return isError:true')
  }
  if (JSON.stringify(noConfirmEmail.body).includes('"sent":true')) {
    throw new Error('send_outreach_email without confirm appears to have sent something')
  }

  console.log('=== OAuth: GET /.well-known/oauth-protected-resource ===')
  const prmRes = await fetch(`${BASE_URL}/.well-known/oauth-protected-resource`)
  const prm = await prmRes.json()
  console.log(JSON.stringify(prm, null, 2))
  if (!prm.resource || !Array.isArray(prm.authorization_servers) || prm.authorization_servers.length === 0) {
    throw new Error('protected resource metadata missing resource or authorization_servers')
  }
  if (prm.resource !== 'https://placeholder.supabase.co/functions/v1/crm-mcp') {
    throw new Error(`expected resource to fall back to the Supabase URL shape when MCP_PUBLIC_URL is unset, got ${prm.resource}`)
  }

  console.log('=== OAuth: GET /.well-known/oauth-authorization-server ===')
  const metaRes = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`)
  const meta = await metaRes.json()
  console.log(JSON.stringify(meta, null, 2))
  if (!meta.authorization_endpoint || !meta.token_endpoint || !meta.registration_endpoint) {
    throw new Error('metadata missing required endpoints')
  }
  if (meta.issuer !== 'https://placeholder.supabase.co/functions/v1/crm-mcp') {
    throw new Error(`expected issuer to fall back to the Supabase URL shape when MCP_PUBLIC_URL is unset, got ${meta.issuer}`)
  }

  console.log('=== OAuth: POST /register ===')
  const regRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] }),
  })
  const reg = await regRes.json()
  console.log(JSON.stringify(reg, null, 2))
  if (!reg.client_id) throw new Error('register did not return a client_id')

  console.log('=== OAuth: GET /authorize with bad redirect_uri (expect 400) ===')
  const badRedirect = await fetch(
    `${BASE_URL}/authorize?redirect_uri=https://evil.example.com/cb&code_challenge=x&code_challenge_method=S256`,
  )
  console.log('status:', badRedirect.status)
  if (badRedirect.status !== 400) throw new Error('expected 400 for bad redirect_uri')

  const REAL_REDIRECT = 'https://claude.ai/api/mcp/auth_callback'
  const CODE_CHALLENGE = 'test-challenge-value'

  console.log('=== OAuth: POST /authorize with WRONG token (expect 302 back to /authorize with error) ===')
  const wrongTokenRes = await fetch(`${BASE_URL}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      redirect_uri: REAL_REDIRECT,
      client_id: 'test-client',
      code_challenge: CODE_CHALLENGE,
      state: 'test-state',
      token: 'wrong-token-value',
    }),
    redirect: 'manual',
  })
  console.log('status:', wrongTokenRes.status)
  const wrongTokenLocation = wrongTokenRes.headers.get('location')
  console.log('location:', wrongTokenLocation)
  if (wrongTokenRes.status !== 302) {
    throw new Error(`expected 302 for wrong token, got ${wrongTokenRes.status}`)
  }
  if (!wrongTokenLocation || !wrongTokenLocation.startsWith('/authorize')) {
    throw new Error(`expected redirect Location to start with /authorize (relative), got ${wrongTokenLocation}`)
  }
  if (!wrongTokenLocation.includes('error=invalid_token')) {
    throw new Error(`expected redirect Location to include error=invalid_token, got ${wrongTokenLocation}`)
  }
  if (!wrongTokenLocation.includes(`code_challenge=${encodeURIComponent(CODE_CHALLENGE)}`)) {
    throw new Error(`expected redirect Location to preserve code_challenge, got ${wrongTokenLocation}`)
  }
  if (!wrongTokenLocation.includes('code_challenge_method=S256')) {
    throw new Error(`expected redirect Location to include code_challenge_method=S256, got ${wrongTokenLocation}`)
  }

  console.log('=== OAuth: POST /authorize with CORRECT token (expect 302 redirect with code) ===')
  const rightTokenRes = await fetch(`${BASE_URL}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      redirect_uri: REAL_REDIRECT,
      client_id: 'test-client',
      code_challenge: CODE_CHALLENGE,
      state: 'test-state',
      token: TEST_TOKEN,
    }),
    redirect: 'manual',
  })
  console.log('status:', rightTokenRes.status)
  const location = rightTokenRes.headers.get('location')
  console.log('location:', location)
  if (rightTokenRes.status !== 302 || !location || !location.includes('code=')) {
    throw new Error('expected a 302 redirect containing a code')
  }

  console.log('=== OAuth: full loop — authorize with real PKCE, then exchange at /token ===')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  const fullAuthRes = await fetch(`${BASE_URL}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      redirect_uri: REAL_REDIRECT,
      client_id: 'test-client',
      code_challenge: codeChallenge,
      state: 'test-state',
      token: TEST_TOKEN,
    }),
    redirect: 'manual',
  })
  const fullAuthLocation = fullAuthRes.headers.get('location')
  const issuedCode = new URL(fullAuthLocation).searchParams.get('code')
  console.log('issued code (truncated):', issuedCode.slice(0, 20) + '...')

  const tokenRes = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: issuedCode,
      code_verifier: codeVerifier,
    }),
  })
  const tokenBody = await tokenRes.json()
  console.log(JSON.stringify(tokenBody, null, 2))
  if (tokenBody.access_token !== TEST_TOKEN) {
    throw new Error(`expected access_token to equal TEST_TOKEN, got ${tokenBody.access_token}`)
  }

  console.log('=== OAuth: use the returned access_token against the real / JSON-RPC endpoint ===')
  const finalListRes = await rpc('tools/list', {}, 999, tokenBody.access_token)
  const finalNames = finalListRes.body.result.tools.map((t) => t.name)
  console.log('tools/list via OAuth-issued token, count:', finalNames.length)
  if (finalNames.length !== 21) throw new Error(`expected 21 tools, got ${finalNames.length}`)

  console.log('=== OAuth: /token with WRONG code_verifier (expect invalid_grant) ===')
  const wrongVerifierRes = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: issuedCode,
      code_verifier: 'totally-wrong-verifier',
    }),
  })
  const wrongVerifierBody = await wrongVerifierRes.json()
  console.log('status:', wrongVerifierRes.status, JSON.stringify(wrongVerifierBody))
  if (wrongVerifierRes.status !== 400 || wrongVerifierBody.error !== 'invalid_grant') {
    throw new Error('expected 400 invalid_grant for wrong code_verifier')
  }

  console.log('ALL CHECKS PASSED')
  proc.kill()
  process.exit(0)
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  proc.kill()
  process.exit(1)
})
