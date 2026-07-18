import { next } from '@vercel/functions'

export const config = {
  matcher: [
    '/',
    '/register',
    '/authorize',
    '/token',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
  ],
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url)

  // The SPA owns GET / — only intercept the MCP JSON-RPC POST (and its
  // OPTIONS preflight) at the same path.
  if (url.pathname === '/' && request.method === 'GET') {
    return next()
  }

  const target = process.env.SUPABASE_CRM_MCP_URL
  if (!target) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_CRM_MCP_URL is not configured' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const headers = new Headers(request.headers)
  headers.delete('host')

  const hasBody = !['GET', 'HEAD'].includes(request.method)

  try {
    return await fetch(`${target}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Required by the Fetch spec whenever a streaming body is sent.
      ...(hasBody ? { duplex: 'half' } : {}),
      // The /authorize success path 302s to claude.ai — that redirect must
      // reach the browser untouched, never be followed by this fetch.
      redirect: 'manual',
    } as RequestInit)
  } catch {
    return new Response(
      JSON.stringify({ error: 'crm-mcp upstream unreachable' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
