export const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function jsonRpcResult(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export function jsonRpcError(id: unknown, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
