import { CORS } from './jsonRpc.ts'
import { timingSafeEqual } from './auth.ts'

export const ALLOWED_REDIRECT_URIS = ['https://claude.ai/api/mcp/auth_callback']

function crmMcpBaseUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-mcp`
}

export function base64urlEncode(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlEncodeString(s: string): string {
  return base64urlEncode(new TextEncoder().encode(s))
}

export function base64urlDecodeToString(s: string): string {
  const pad = (4 - (s.length % 4)) % 4
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return base64urlEncode(new Uint8Array(sig))
}

export async function sha256Base64url(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return base64urlEncode(new Uint8Array(hash))
}

export async function handleMetadata(_req: Request): Promise<Response> {
  const base = crmMcpBaseUrl()
  const body = {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export async function handleRegister(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const clientId = crypto.randomUUID()
  return new Response(
    JSON.stringify({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris ?? [],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    }),
    { status: 201, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}

function renderAuthorizeForm(params: {
  redirectUri: string
  clientId: string
  codeChallenge: string
  state: string
  error?: string
}): Response {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Authorize Brisk CRM connector</title></head>
<body style="font-family: sans-serif; max-width: 420px; margin: 60px auto;">
  <h2>Authorize Brisk CRM connector</h2>
  <p>Enter your CRM_MCP_TOKEN to allow this connector to access your CRM.</p>
  ${params.error ? `<p style="color:#c00">${params.error}</p>` : ''}
  <form method="POST">
    <input type="hidden" name="redirect_uri" value="${params.redirectUri}" />
    <input type="hidden" name="client_id" value="${params.clientId}" />
    <input type="hidden" name="code_challenge" value="${params.codeChallenge}" />
    <input type="hidden" name="state" value="${params.state}" />
    <input type="password" name="token" placeholder="CRM_MCP_TOKEN"
      style="width:100%;padding:8px;margin:12px 0;box-sizing:border-box;" autofocus />
    <button type="submit" style="padding:8px 16px;">Authorize</button>
  </form>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function handleAuthorizeGet(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  const clientId = url.searchParams.get('client_id') ?? ''
  const codeChallenge = url.searchParams.get('code_challenge') ?? ''
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? ''
  const state = url.searchParams.get('state') ?? ''

  if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400, headers: CORS })
  }
  if (codeChallengeMethod !== 'S256' || !codeChallenge) {
    return new Response('PKCE code_challenge (S256) is required', { status: 400, headers: CORS })
  }

  return renderAuthorizeForm({ redirectUri, clientId, codeChallenge, state })
}

export async function signAuthCode(
  payload: { redirect_uri: string; code_challenge: string; exp: number },
  secret: string,
): Promise<string> {
  const payloadB64 = base64urlEncodeString(JSON.stringify(payload))
  const signature = await hmacSign(payloadB64, secret)
  return `${payloadB64}.${signature}`
}

export async function handleAuthorizePost(req: Request): Promise<Response> {
  const form = await req.formData()
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const clientId = String(form.get('client_id') ?? '')
  const codeChallenge = String(form.get('code_challenge') ?? '')
  const state = String(form.get('state') ?? '')
  const token = String(form.get('token') ?? '')

  if (!ALLOWED_REDIRECT_URIS.includes(redirectUri)) {
    return new Response('Invalid redirect_uri', { status: 400, headers: CORS })
  }

  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected || !(await timingSafeEqual(token, expected))) {
    return renderAuthorizeForm({
      redirectUri, clientId, codeChallenge, state,
      error: 'Incorrect token — try again.',
    })
  }

  const code = await signAuthCode(
    { redirect_uri: redirectUri, code_challenge: codeChallenge, exp: Date.now() + 5 * 60_000 },
    expected,
  )

  const redirectUrl = new URL(redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (state) redirectUrl.searchParams.set('state', state)

  return new Response(null, { status: 302, headers: { ...CORS, Location: redirectUrl.toString() } })
}
