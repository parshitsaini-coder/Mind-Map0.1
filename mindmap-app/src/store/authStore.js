import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const useAuthStore = create((set, get) => ({
  user: null, // { id, name, email }
  initialized: false,
  loading: false,
  error: null,
  // Set after a signup that needs email confirmation, so the UI can show
  // "check your inbox" instead of logging the user straight in.
  pendingEmail: null,

  // Called once on app start — restores an existing session (if any) and
  // subscribes to future auth changes (login/logout in this or another tab).
  init: async () => {
    if (!isSupabaseConfigured) {
      set({ initialized: true })
      return
    }
    const { data } = await supabase.auth.getSession()
    const sessionUser = data?.session?.user
    set({
      user: sessionUser
        ? {
            id: sessionUser.id,
            name: sessionUser.user_metadata?.display_name || 'User',
            email: sessionUser.email,
          }
        : null,
      initialized: true,
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      set({
        user: u
          ? { id: u.id, name: u.user_metadata?.display_name || 'User', email: u.email }
          : null,
      })
    })
  },

  signUp: async (name, email, password) => {
    if (!isSupabaseConfigured) {
      set({ error: 'Cloud save isn\u2019t set up yet (missing Supabase keys).' })
      return false
    }
    if (!name.trim() || !email.trim() || !password) {
      set({ error: 'Enter your name, email and password.' })
      return false
    }
    if (!EMAIL_RE.test(email.trim())) {
      set({ error: 'Enter a valid email address.' })
      return false
    }
    if (password.length < 6) {
      set({ error: 'Password must be at least 6 characters.' })
      return false
    }
    set({ loading: true, error: null, pendingEmail: null })
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    })
    set({ loading: false })
    if (error) {
      set({
        error: error.message.toLowerCase().includes('already registered')
          ? 'That email is already registered — try logging in instead.'
          : error.message,
      })
      return false
    }
    // If Supabase has "Confirm email" turned on (the default, and the
    // recommended setting for real-email accounts), signUp() returns a user
    // but no active session until they click the link in their inbox.
    if (data?.user && !data?.session) {
      set({ pendingEmail: email.trim() })
      return 'confirm'
    }
    if (data?.user) {
      set({ user: { id: data.user.id, name: name.trim(), email: email.trim() } })
      return true
    }
    return false
  },

  signIn: async (email, password) => {
    if (!isSupabaseConfigured) {
      set({ error: 'Cloud save isn\u2019t set up yet (missing Supabase keys).' })
      return false
    }
    if (!email.trim() || !password) {
      set({ error: 'Enter your email and password.' })
      return false
    }
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    set({ loading: false })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        set({ error: 'Please confirm your email first — check your inbox for the link.' })
      } else {
        set({ error: 'Wrong email or password.' })
      }
      return false
    }
    if (data?.user) {
      set({
        user: {
          id: data.user.id,
          name: data.user.user_metadata?.display_name || 'User',
          email: data.user.email,
        },
      })
      return true
    }
    return false
  },

  resendConfirmation: async (email) => {
    if (!isSupabaseConfigured || !email) return false
    set({ loading: true, error: null })
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    set({ loading: false })
    if (error) {
      set({ error: error.message })
      return false
    }
    return true
  },

  signOut: async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    set({ user: null, pendingEmail: null })
  },

  clearError: () => set({ error: null }),
}))
