process.env.SUPABASE_CRM_MCP_URL = 'https://placeholder.supabase.co/functions/v1/crm-mcp'

const calls = []
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init })
  if (String(url).includes('/authorize')) {
    return new Response(null, {
      status: 302,
      headers: { Location: 'https://claude.ai/api/mcp/auth_callback?code=abc' },
    })
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function authorizeUrl(params) {
  const u = new URL('https://brisk-crm.vercel.app/authorize')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, v)
  }
  return u.toString()
}

const { default: middleware } = await import('../middleware.ts')

async function main() {
  console.log('=== GET / passes through to the SPA (next()) ===')
  const passthrough = await middleware(new Request('https://brisk-crm.vercel.app/', { method: 'GET' }))
  if (passthrough.headers.get('x-middleware-next') !== '1') {
    throw new Error('expected GET / to call next() (x-middleware-next header missing)')
  }

  console.log('=== POST / proxies to crm-mcp root ===')
  const rpcRes = await middleware(new Request('https://brisk-crm.vercel.app/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  }))
  if (rpcRes.headers.get('x-middleware-next') === '1') {
    throw new Error('expected POST / to be proxied, not passed through')
  }
  if (calls[calls.length - 1].url !== 'https://placeholder.supabase.co/functions/v1/crm-mcp/') {
    throw new Error(`expected proxy target root, got ${calls[calls.length - 1].url}`)
  }
  if (calls[calls.length - 1].init.duplex !== 'half') {
    throw new Error('expected duplex: "half" on the proxied POST request')
  }

  console.log('=== GET /.well-known/oauth-authorization-server proxies verbatim ===')
  await middleware(new Request('https://brisk-crm.vercel.app/.well-known/oauth-authorization-server'))
  if (!calls[calls.length - 1].url.endsWith('/.well-known/oauth-authorization-server')) {
    throw new Error('expected well-known path to be proxied verbatim')
  }

  console.log('=== POST /authorize: upstream 302 redirect passes through untouched ===')
  const authRes = await middleware(new Request('https://brisk-crm.vercel.app/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=x',
  }))
  if (authRes.status !== 302 || !authRes.headers.get('location')?.includes('claude.ai')) {
    throw new Error('expected the upstream 302 redirect to pass through untouched')
  }
  if (calls[calls.length - 1].init.redirect !== 'manual') {
    throw new Error(`expected redirect: 'manual' on /authorize fetch call, but got redirect: '${calls[calls.length - 1].init.redirect}'`)
  }

  console.log('=== GET /authorize with valid params renders the form locally (200, HTML) ===')
  const callsBeforeValidAuthorize = calls.length
  const validAuthorizeRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client_id: 'test-client',
      code_challenge: 'abc123',
      code_challenge_method: 'S256',
      state: 'xyz',
    }),
    { method: 'GET' },
  ))
  if (validAuthorizeRes.status !== 200) {
    throw new Error(`expected 200 for valid GET /authorize, got ${validAuthorizeRes.status}`)
  }
  const validAuthorizeHtml = await validAuthorizeRes.text()
  if (!validAuthorizeHtml.includes('name="token"')) {
    throw new Error('expected rendered form to contain the token input field')
  }
  if (calls.length !== callsBeforeValidAuthorize) {
    throw new Error('expected GET /authorize to be rendered locally, not proxied to Supabase')
  }

  console.log('=== GET /authorize with invalid redirect_uri returns 400 ===')
  const badRedirectRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://evil.example.com/cb',
      client_id: 'test-client',
      code_challenge: 'abc123',
      code_challenge_method: 'S256',
      state: 'xyz',
    }),
    { method: 'GET' },
  ))
  if (badRedirectRes.status !== 400) {
    throw new Error(`expected 400 for invalid redirect_uri, got ${badRedirectRes.status}`)
  }

  console.log('=== GET /authorize with missing code_challenge_method returns 400 ===')
  const missingPkceRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client_id: 'test-client',
      code_challenge: 'abc123',
      state: 'xyz',
    }),
    { method: 'GET' },
  ))
  if (missingPkceRes.status !== 400) {
    throw new Error(`expected 400 for missing code_challenge_method, got ${missingPkceRes.status}`)
  }

  console.log('=== GET /authorize with error=invalid_token shows the error message ===')
  const errorRes = await middleware(new Request(
    authorizeUrl({
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client_id: 'test-client',
      code_challenge: 'abc123',
      code_challenge_method: 'S256',
      state: 'xyz',
      error: 'invalid_token',
    }),
    { method: 'GET' },
  ))
  if (errorRes.status !== 200) {
    throw new Error(`expected 200 for GET /authorize with error param, got ${errorRes.status}`)
  }
  const errorHtml = await errorRes.text()
  if (!errorHtml.includes('Incorrect token')) {
    throw new Error('expected rendered form to include the error message when error=invalid_token')
  }

  console.log('=== Missing SUPABASE_CRM_MCP_URL returns 502 ===')
  delete process.env.SUPABASE_CRM_MCP_URL
  const missingEnvRes = await middleware(new Request('https://brisk-crm.vercel.app/register', { method: 'POST' }))
  if (missingEnvRes.status !== 502) throw new Error('expected 502 when SUPABASE_CRM_MCP_URL is unset')

  console.log('ALL CHECKS PASSED')
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
