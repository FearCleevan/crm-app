export const ALLOWED_REDIRECT_URIS = ['https://claude.ai/api/mcp/auth_callback']

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderAuthorizeForm(params: {
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
  ${params.error ? `<p style="color:#c00">${escapeHtml(params.error)}</p>` : ''}
  <form method="POST">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
    <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
    <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
    <input type="password" name="token" placeholder="CRM_MCP_TOKEN"
      style="width:100%;padding:8px;margin:12px 0;box-sizing:border-box;" autofocus />
    <button type="submit" style="padding:8px 16px;">Authorize</button>
  </form>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  })
}
