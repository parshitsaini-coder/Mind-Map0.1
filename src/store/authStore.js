import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export const useAuthStore = create((set) => ({
  user: null, // { id, name, username, email }
  initialized: false,
  loading: false,
  error: null,
  // Set after a signup that needs email confirmation, so the UI can show
  // "check your inbox" instead of logging the user straight in.
  pendingEmail: null,
  // Set for the split second Supabase redirects back from Google, so the
  // panel can show a "signing you in…" state instead of the login form.
  oauthPending: false,
  // Set when the visitor arrived via a password-reset email link (Supabase
  // fires a PASSWORD_RECOVERY auth event and gives them a real session
  // scoped only to changing their password) — the panel swaps to the "set
  // a new password" form while this is true.
  passwordRecovery: false,
  resetEmailSent: null,

  // Called once on app start — restores an existing session (if any) and
  // subscribes to future auth changes (login/logout in this or another
  // tab, Google OAuth redirect completing, password-recovery links).
  init: async () => {
    if (!isSupabaseConfigured) {
      set({ initialized: true })
      return
    }
    const { data } = await supabase.auth.getSession()
    const sessionUser = data?.session?.user
    set({
      user: sessionUser ? toAuthUser(sessionUser) : null,
      initialized: true,
    })

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        set({ passwordRecovery: true })
        return
      }
      const u = session?.user
      set({ user: u ? toAuthUser(u) : null, oauthPending: false })
    })
  },

  signUp: async (name, username, email, password) => {
    if (!isSupabaseConfigured) {
      set({ error: 'Cloud save isn\u2019t set up yet (missing Supabase keys).' })
      return false
    }
    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      set({ error: 'Fill in your name, username, email and password.' })
      return false
    }
    if (!USERNAME_RE.test(username.trim())) {
      set({ error: 'Username must be 3-20 characters: letters, numbers, underscore only.' })
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
      options: { data: { display_name: name.trim(), username: username.trim() } },
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
      set({ user: { id: data.user.id, name: name.trim(), username: username.trim(), email: email.trim() } })
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
      set({ user: toAuthUser(data.user) })
      return true
    }
    return false
  },

  // Redirects the browser to Google's consent screen; Supabase handles the
  // OAuth dance and bounces back here with a session already active, which
  // the onAuthStateChange subscriber above picks up.
  signInWithGoogle: async () => {
    if (!isSupabaseConfigured) {
      set({ error: 'Cloud save isn\u2019t set up yet (missing Supabase keys).' })
      return false
    }
    set({ loading: true, error: null, oauthPending: true })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      set({ loading: false, oauthPending: false, error: error.message })
      return false
    }
    // Browser is navigating away to Google now — loading/oauthPending stay
    // true until the redirect back triggers onAuthStateChange.
    return true
  },

  // "Forgot password" — emails the user a link back into the app with a
  // recovery session attached (handled by the PASSWORD_RECOVERY event).
  sendPasswordReset: async (email) => {
    if (!isSupabaseConfigured) {
      set({ error: 'Cloud save isn\u2019t set up yet (missing Supabase keys).' })
      return false
    }
    if (!EMAIL_RE.test(email.trim())) {
      set({ error: 'Enter a valid email address.' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    set({ loading: false })
    if (error) {
      set({ error: error.message })
      return false
    }
    set({ resetEmailSent: email.trim() })
    return true
  },

  // Called from the "set a new password" form shown while passwordRecovery
  // is true.
  updatePassword: async (newPassword) => {
    if (newPassword.length < 6) {
      set({ error: 'Password must be at least 6 characters.' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    set({ loading: false })
    if (error) {
      set({ error: error.message })
      return false
    }
    set({ passwordRecovery: false })
    return true
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
  clearResetEmailSent: () => set({ resetEmailSent: null }),
}))

function toAuthUser(sessionUser) {
  return {
    id: sessionUser.id,
    name: sessionUser.user_metadata?.display_name || sessionUser.user_metadata?.full_name || 'User',
    username: sessionUser.user_metadata?.username || null,
    email: sessionUser.email,
  }
}
