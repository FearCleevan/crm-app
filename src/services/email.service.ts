import { supabase } from '@/lib/supabase'

interface SendEmailParams {
  to:       string | string[]
  cc?:      string | string[]
  subject:  string
  html:     string
}

export const emailService = {
  async send(params: SendEmailParams): Promise<void> {
    const { error } = await supabase.functions.invoke('send-email', {
      body: params,
    })
    if (error) throw new Error(error.message ?? 'Failed to send email')
  },
}
