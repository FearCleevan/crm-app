import { next } from '@vercel/functions'
import { ALLOWED_REDIRECT_URIS, renderAuthorizeForm } from './authorize-form'

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

  if (url.pathname === '/authorize' && request.method === 'GET') {
    const redirectUri = url.searchParams.get('redirect_uri') ?? ''
    const clientId = url.searchParams.get('client_id') ?? ''
    const codeChallenge = url.searchParams.get('code_challenge') ?? ''
    const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? ''
    const state = url.searchParams.get('state') ?? ''
    const errorParam = url.searchParams.get('error') ?? ''

    if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
      return new Response('Invalid redirect_uri', { status: 400 })
    }
    if (codeChallengeMethod !== 'S256' || !codeChallenge) {
      return new Response('PKCE code_challenge (S256) is required', { status: 400 })
    }

    return renderAuthorizeForm({
      redirectUri,
      clientId,
      codeChallenge,
      state,
      error: errorParam === 'invalid_token' ? 'Incorrect token — try again.' : undefined,
    })
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
