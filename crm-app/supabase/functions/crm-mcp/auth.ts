export function checkAuth(req: Request): boolean {
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected) return false
  return req.headers.get('Authorization') === `Bearer ${expected}`
}
