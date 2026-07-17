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
