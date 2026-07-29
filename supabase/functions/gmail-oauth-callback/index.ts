// ============================================================
// Paul CRM — gmail-oauth-callback Edge Function
// Handles Google's OAuth redirect: exchanges the auth code for tokens, stores them in
// `integrations` (provider: 'gmail'), then bounces the browser back to the CRM's Settings page.
// Requires: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase Secrets.
// Part of Phase 3a, EMAIL_INBOX_SENT_DRAFTS_BACKEND_IMPLEMENTATION.md.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function functionUrl(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-oauth-callback`
}

function redirectToSettings(origin: string, result: 'connected' | 'error', message?: string) {
  const url = new URL('/settings', origin)
  url.searchParams.set('tab', 'api')
  url.searchParams.set('gmail', result)
  if (message) url.searchParams.set('gmail_error', message)
  return new Response(null, { status: 302, headers: { Location: url.toString() } })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  let userId = ''
  let origin = ''
  try {
    const decoded = JSON.parse(atob(state ?? ''))
    userId = decoded.userId
    origin = decoded.origin
  } catch {
    return new Response('Invalid or missing state parameter', { status: 400 })
  }

  if (oauthError) {
    console.error('[gmail-oauth-callback] Google returned error:', oauthError)
    return redirectToSettings(origin, 'error', oauthError)
  }
  if (!code) {
    return redirectToSettings(origin, 'error', 'missing_code')
  }

  const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error('[gmail-oauth-callback] GOOGLE_CLIENT_ID/SECRET not set')
    return redirectToSettings(origin, 'error', 'not_configured')
  }

  try {
    // ── 1. Exchange the auth code for tokens ──────────────────
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  functionUrl(),
        grant_type:    'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error('[gmail-oauth-callback] token exchange failed:', JSON.stringify(tokenData))
      // No refresh_token usually means the user has connected before without revoking access —
      // Google only issues one on first consent. `prompt=consent` on the client side should
      // prevent this, but surface a clear error if it happens anyway.
      return redirectToSettings(origin, 'error', tokenData.error ?? 'token_exchange_failed')
    }

    // ── 2. Look up which Gmail address was just connected ─────
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json().catch(() => null)
    const connectedEmail = profile?.emailAddress ?? 'unknown'

    // ── 3. Store the refresh token in `integrations` ──────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { error: dbError } = await admin
      .from('integrations')
      .upsert(
        {
          user_id:  userId,
          provider: 'gmail',
          label:    'Gmail',
          config:   { refresh_token: tokenData.refresh_token, email: connectedEmail },
          status:   'active',
        },
        { onConflict: 'user_id,provider' },
      )
    if (dbError) {
      console.error('[gmail-oauth-callback] db upsert failed:', dbError.message)
      return redirectToSettings(origin, 'error', 'save_failed')
    }

    console.log('[gmail-oauth-callback] connected:', connectedEmail, 'for user:', userId)
    return redirectToSettings(origin, 'connected')
  } catch (err) {
    console.error('[gmail-oauth-callback] unhandled error:', err)
    return redirectToSettings(origin, 'error', 'internal_error')
  }
})
