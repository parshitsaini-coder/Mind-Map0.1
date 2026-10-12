import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// If the env vars aren't set (e.g. running locally without a `.env` yet),
// we still export a client-shaped object so imports don't crash — every
// call site checks `isSupabaseConfigured` first and falls back to local
// (localStorage-only) mode with a friendly toast instead of a hard error.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null
