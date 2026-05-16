import { supabase } from './supabase'

const LS_REMEMBER = 'brisk_remember_me'
const SS_SESSION  = 'brisk_session_active'

export async function signIn(email: string, password: string, rememberMe = true) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  // Track persistence preference so INITIAL_SESSION can enforce it
  localStorage.setItem(LS_REMEMBER, String(rememberMe))
  sessionStorage.setItem(SS_SESSION, '1')
  return data
}

export function shouldClearSessionOnLoad(): boolean {
  const remember = localStorage.getItem(LS_REMEMBER)
  const activeTab = sessionStorage.getItem(SS_SESSION)
  // If user did NOT choose remember-me and this is a new browser session (tab closed), clear auth
  return remember === 'false' && !activeTab
}

export function markSessionActive() {
  sessionStorage.setItem(SS_SESSION, '1')
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  return user
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  return session
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw new Error(error.message)
}
