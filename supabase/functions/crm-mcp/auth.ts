export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  const bytesA = new Uint8Array(hashA)
  const bytesB = new Uint8Array(hashB)
  if (bytesA.length !== bytesB.length) return false
  let diff = 0
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i]
  }
  return diff === 0
}

export async function checkAuth(req: Request): Promise<boolean> {
  const expected = Deno.env.get('CRM_MCP_TOKEN')
  if (!expected) return false
  const received = req.headers.get('Authorization')
  if (!received) return false
  return timingSafeEqual(received, `Bearer ${expected}`)
}
