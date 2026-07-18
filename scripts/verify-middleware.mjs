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
