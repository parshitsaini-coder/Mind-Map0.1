// Phase 7 — connects the terminal store to Supabase (`public.terminal_accounts`, one row per user).
// All the logic lives in cloudSync.js / terminalSync.js; this file only supplies the real pieces.
// Everything is a quiet no-op when Supabase isn't configured or nobody is signed in, so the
// terminal keeps working exactly as before (local-only).
import { supabase, isSupabaseConfigured } from '../supabaseClient'
import { useTerminalStore } from '../../store/terminalStore'
import { createTerminalSync } from './terminalSync.js'
import { markSeen } from './lastSeen.js'

const TABLE = 'terminal_accounts'
const MIN_GAP_SEC = 120 // same threshold TradingEngine uses before replaying missed price action

const plain = (e) => (e ? { code: e.code, message: e.message, details: e.details, status: e.status } : null)
const nowIso = () => new Date().toISOString()
const failure = (e) => ({ error: { message: String(e?.message || e) } })

const remote = {
  async fetch(uid) {
    try {
      const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', uid).maybeSingle()
      return { row: data || null, error: plain(error) }
    } catch (e) { return { row: null, ...failure(e) } }
  },
  async insert(uid, cols) {
    try {
      const { data, error } = await supabase.from(TABLE).insert({ user_id: uid, ...cols, updated_at: nowIso() }).select('updated_at').single()
      return { updatedAt: data?.updated_at || null, error: plain(error) }
    } catch (e) { return { updatedAt: null, ...failure(e) } }
  },
  // Compare-and-swap: only writes if the row is still at the `updated_at` we last saw.
  async update(uid, cols, expectedTs) {
    try {
      const { data, error } = await supabase.from(TABLE).update({ ...cols, updated_at: nowIso() }).eq('user_id', uid).eq('updated_at', expectedTs).select('updated_at')
      return { updatedAt: data?.[0]?.updated_at || null, error: plain(error) }
    } catch (e) { return { updatedAt: null, ...failure(e) } }
  },
}

export const terminalCloud = createTerminalSync({
  store: useTerminalStore,
  remote,
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  onNotice: (text) => useTerminalStore.getState().notify(text, 'info'),
  onTrimmed: (n) => useTerminalStore.getState().notify(`Cloud copy keeps your newest trades — ${n} oldest left out (size limit)`, 'info'),
  // Positions/orders that arrive from another device were last processed at the cloud save time:
  // replay what price did since then, exactly like the offline catch-up on this device.
  onPulled: (savedSec) => {
    const now = Math.floor(Date.now() / 1000)
    if (now - savedSec > MIN_GAP_SEC) useTerminalStore.getState().catchUp(savedSec, now)
    markSeen(now)
  },
})

let listening = false
const onOnline = () => terminalCloud.sync()
const onVisible = () => (document.hidden ? terminalCloud.flush() : terminalCloud.sync())
const onHide = () => terminalCloud.flush()

export function startTerminalCloud(userId) {
  if (!isSupabaseConfigured || !userId) return
  if (!listening && typeof window !== 'undefined') {
    listening = true
    window.addEventListener('online', onOnline)
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisible)
  }
  terminalCloud.start(userId)
}

export function stopTerminalCloud() {
  terminalCloud.stop()
  if (listening && typeof window !== 'undefined') {
    listening = false
    window.removeEventListener('online', onOnline)
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
