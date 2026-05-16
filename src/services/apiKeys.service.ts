import { supabase } from '@/lib/supabase'

export interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

export const apiKeysService = {
  async listKeys(userId: string): Promise<ApiKeyRow[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ApiKeyRow[]
  },

  // Generates key client-side (authenticated user, RLS enforced).
  // Returns the full plaintext key ONCE — never stored.
  async generateKey(userId: string, name: string): Promise<{ key: string; row: ApiKeyRow }> {
    const key = `sk_live_${randomHex(30)}`
    const keyHash = await sha256hex(key)

    const { data, error } = await supabase
      .from('api_keys')
      .insert({ user_id: userId, name, key_prefix: key.slice(0, 14), key_hash: keyHash })
      .select('id, name, key_prefix, last_used_at, created_at')
      .single()

    if (error) throw error
    return { key, row: data as ApiKeyRow }
  },

  async revokeKey(id: string): Promise<void> {
    const { error } = await supabase.from('api_keys').delete().eq('id', id)
    if (error) throw error
  },
}
