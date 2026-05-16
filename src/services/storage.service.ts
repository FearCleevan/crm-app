import { supabase } from '@/lib/supabase'

export const storageService = {
  async uploadAvatar(file: File): Promise<string> {
    // Use auth.uid() for the path so storage RLS can verify ownership
    const { data: { session } } = await supabase.auth.getSession()
    const authId = session?.user?.id
    if (!authId) throw new Error('Not authenticated')

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${authId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  },

  async uploadEmailImage(file: File): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    const authId = session?.user?.id
    if (!authId) throw new Error('Not authenticated')

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${authId}/email-images/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  },
}
