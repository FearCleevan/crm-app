import { supabase } from '@/lib/supabase'
import type { ImportSessionRow, ProspectInsert, ProspectRow } from '@/types/database'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface ImportChunkPayload {
  toInsert:    ProspectInsert[]
  toMerge:     Array<{ id: number } & Partial<ProspectRow>>
  toOverwrite: Array<ProspectInsert & { id: number }>
  sessionId:   string
  chunkIndex:  number
  totalChunks: number
  cumulativeInserted: number
  cumulativeMerged:   number
  cumulativeFailed:   number
}

export interface ImportChunkResult {
  inserted: number
  merged:   number
  failed:   number
  errors:   string[]
}

// ── Direct fallback when Edge Function is not deployed ──────────
async function processChunkDirect(
  payload: ImportChunkPayload,
): Promise<ImportChunkResult> {
  const { toInsert, toMerge, toOverwrite, sessionId, chunkIndex, totalChunks,
          cumulativeInserted, cumulativeMerged, cumulativeFailed } = payload

  let inserted = 0, merged = 0, failed = 0
  const errors: string[] = []

  if (toInsert.length > 0) {
    const { error } = await supabase.from('prospects').insert(toInsert)
    if (error) { failed += toInsert.length; errors.push(`Insert: ${error.message}`) }
    else inserted += toInsert.length
  }
  if (toMerge.length > 0) {
    const { error } = await supabase.from('prospects').upsert(toMerge, { onConflict: 'id' })
    if (error) { failed += toMerge.length; errors.push(`Merge: ${error.message}`) }
    else merged += toMerge.length
  }
  if (toOverwrite.length > 0) {
    const { error } = await supabase.from('prospects').upsert(toOverwrite, { onConflict: 'id' })
    if (error) { failed += toOverwrite.length; errors.push(`Overwrite: ${error.message}`) }
    else merged += toOverwrite.length
  }

  if (sessionId) {
    const isLast = chunkIndex + 1 >= totalChunks
    await supabase.from('import_sessions').update({
      processed_chunks:   chunkIndex + 1,
      successful_imports: cumulativeInserted + inserted + cumulativeMerged + merged,
      failed_imports:     cumulativeFailed + failed,
      chunk_errors:       errors.length > 0 ? errors : null,
      status:             isLast ? 'completed' : 'processing',
      completed_at:       isLast ? new Date().toISOString() : null,
      updated_at:         new Date().toISOString(),
    }).eq('session_id', sessionId)
  }

  return { inserted, merged, failed, errors }
}

export const importService = {
  // ── Create a new import audit session ──────────────────────
  async createSession(params: {
    session_id: string
    total_chunks: number
    total_prospects: number
    created_by: string
  }) {
    const { data, error } = await supabase
      .from('import_sessions')
      .insert({ ...params, processed_chunks: 0, successful_imports: 0, failed_imports: 0 })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as ImportSessionRow
  },

  async getSession(session_id: string) {
    const { data, error } = await supabase
      .from('import_sessions')
      .select('*')
      .eq('session_id', session_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as ImportSessionRow | null
  },

  async getRecentSessions(limit = 20) {
    const { data, error } = await supabase
      .from('import_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []) as ImportSessionRow[]
  },

  // ── Process one deduped chunk (Edge Function → direct fallback) ─
  async processChunk(payload: ImportChunkPayload): Promise<ImportChunkResult> {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import', {
        body: payload,
      })
      if (error) throw error
      return data as ImportChunkResult
    } catch {
      // Edge Function not yet deployed — fall back to direct Supabase calls
      return processChunkDirect(payload)
    }
  },

  // ── Mark session as failed ──────────────────────────────────
  async failSession(sessionId: string): Promise<void> {
    await supabase
      .from('import_sessions')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
  },

  // ── Subscribe to session progress via Realtime ──────────────
  subscribeToSession(
    sessionId: string,
    onUpdate: (session: ImportSessionRow) => void,
  ): RealtimeChannel {
    return supabase
      .channel(`import-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'import_sessions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => onUpdate(payload.new as ImportSessionRow),
      )
      .subscribe()
  },
}
