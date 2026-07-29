const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

// GOOGLE_CLIENT_ID is a public OAuth client identifier, safe to ship client-side (unlike the
// client secret, which stays server-side only in the gmail-oauth-callback Edge Function).
export function isGmailOAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
}

// state carries the CRM user id + the app's own origin through Google's redirect, since the
// callback Edge Function is invoked directly by Google (not by our client), so it has no other
// way to know which crm_users row to credit or where to send the browser back to afterward.
export function getGmailAuthUrl(userId: string): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`
  const state = btoa(JSON.stringify({ userId, origin: window.location.origin }))

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         GMAIL_READONLY_SCOPE,
    access_type:   'offline',
    prompt:        'consent',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}
