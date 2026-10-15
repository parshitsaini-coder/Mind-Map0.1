// Phase 12 — the sound engine: decides IF an event makes a sound, which one and how loud, then plays it.
// Web Audio only. Never throws: no AudioContext, a blocked context or a bad setting just means silence.
// Imports nothing from the store; the store hands settings in through `configureSound({ getConfig })`.
import { EVENTS_BY_ID, LIVE_EVENTS, HAPTICS } from './eventCatalog.js'
import { PACKS, SOUNDS, playSound, soundDuration } from './soundDesign.js'

export const COALESCE_MS = 100 // events inside this window collapse into one sound (the highest priority)
export const RATE_LIMIT = 6 // at most this many sounds per RATE_WINDOW_MS
export const RATE_WINDOW_MS = 1000

let getConfig = () => ({ master: true, volume: 80, muteBackground: true, vibrate: false, pack: 'classic', events: {} })
export function configureSound(o = {}) { if (typeof o.getConfig === 'function') getConfig = o.getConfig }

// ── pure decision ────────────────────────────────────────────────────────
// cfg = { master, volume 0-100, muteBackground, vibrate, pack, events: { id: { on, volume 0-100, sound } } }
// Returns { sound, volume (0..1), pack } or null when this event must stay silent.
export function resolvePlay(cfg, eventId, { hidden = false } = {}) {
  const def = EVENTS_BY_ID[eventId]
  if (!def || !cfg || !cfg.master) return null
  if (cfg.muteBackground && hidden) return null
  const pack = PACKS[cfg.pack] ? cfg.pack : 'classic'
  if (PACKS[pack].only && !PACKS[pack].only.includes(eventId)) return null
  const ev = cfg.events?.[eventId] || {}
  if (ev.on === false || (ev.on === undefined && !def.defaultOn)) return null
  const volume = (clamp01((cfg.volume ?? 80) / 100)) * clamp01((ev.volume ?? 100) / 100)
  if (volume <= 0) return null
  const sound = ev.sound && ev.sound !== 'default' && SOUNDS[ev.sound] ? ev.sound : def.sound
  return { sound, volume, pack }
}
const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0))

// Of several events landing together, pick the one to sound: highest priority among the audible ones
// (earliest wins a tie). Returns { id, play } or null.
export function pickLoudest(cfg, ids, opts) {
  let best = null
  for (const id of ids) {
    const play = resolvePlay(cfg, id, opts)
    if (!play) continue
    const pr = EVENTS_BY_ID[id].priority
    if (!best || pr > best.pr) best = { id, play, pr }
  }
  return best && { id: best.id, play: best.play }
}

// ── audio context + unlock chip ──────────────────────────────────────────
let actx = null
let ctxFactory = null // tests inject a stub
export function setAudioFactory(f) { ctxFactory = f; actx = null }
const listeners = new Set()
let chip = false
const setChip = (v) => { if (chip !== v) { chip = v; listeners.forEach((l) => l()) } }
export const subscribeChip = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const getChip = () => chip

function audio() {
  if (actx) return actx
  try {
    if (ctxFactory) actx = ctxFactory()
    else {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
      actx = AC ? new AC() : null
    }
  } catch { actx = null }
  return actx
}
export const audioSupported = () => {
  if (ctxFactory) return true
  return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
}

// Called from a real pointer/key event: creates the context and resumes it.
export function unlockAudio() {
  const c = audio()
  if (!c) return false
  try {
    if (c.state === 'suspended' && c.resume) {
      const p = c.resume()
      if (p && p.then) p.then(() => setChip(c.state === 'suspended'), () => {})
    }
  } catch { /* ignore */ }
  if (c.state !== 'suspended') setChip(false)
  return true
}
let unlockInstalled = false
export function installUnlock() {
  if (unlockInstalled || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  unlockInstalled = true
  const on = () => { unlockAudio(); if (actx && actx.state === 'running') { window.removeEventListener('pointerdown', on, true); window.removeEventListener('keydown', on, true) } }
  window.addEventListener('pointerdown', on, true)
  window.addEventListener('keydown', on, true)
}

// Plays now (or schedules `delay` seconds ahead). Returns number of oscillators created.
function playNow(play, delay = 0) {
  const c = audio()
  if (!c) return 0
  try {
    if (c.state === 'suspended') {
      try { const p = c.resume?.(); if (p && p.then) p.then(() => setChip(c.state === 'suspended'), () => {}) } catch { /* ignore */ }
      if (c.state === 'suspended') setChip(true)
    }
    return playSound(c, play.sound, (c.currentTime || 0) + delay + 0.005, play.volume, play.pack)
  } catch { return 0 }
}

// ── vibration ────────────────────────────────────────────────────────────
export function vibrateFor(cfg, eventId) {
  const def = EVENTS_BY_ID[eventId]
  if (!def || !def.haptic || !cfg?.vibrate || !cfg.master) return false
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return navigator.vibrate(HAPTICS[def.haptic]) !== false
  } catch { /* ignore */ }
  return false
}

// ── coalescing + rate limit ──────────────────────────────────────────────
let timers = { set: (f, ms) => setTimeout(f, ms), clear: (h) => clearTimeout(h), now: () => Date.now() }
export function setEngineTimers(t) { timers = { ...timers, ...t } }
let pending = []
let handle = null
let stamps = []
export function resetEngine() { if (handle != null) timers.clear(handle); handle = null; pending = []; stamps = [] }

const isHidden = () => typeof document !== 'undefined' && document.hidden === true

function flush() {
  handle = null
  const ids = pending
  pending = []
  const cfg = getConfig()
  const best = pickLoudest(cfg, ids, { hidden: isHidden() })
  if (!best) return null
  const now = timers.now()
  stamps = stamps.filter((t) => now - t < RATE_WINDOW_MS)
  if (stamps.length >= RATE_LIMIT) return null
  stamps.push(now)
  playNow(best.play)
  return best.id
}

// Queue an event for sound. The first event of a burst opens a COALESCE_MS window; when it closes only
// the highest-priority audible event plays. Toasts are not affected (they go through their own subscriber).
export function playEvent(eventId) {
  if (!EVENTS_BY_ID[eventId]) return
  try {
    const cfg = getConfig()
    vibrateFor(cfg, eventId)
    if (!resolvePlay(cfg, eventId, { hidden: isHidden() })) return // nothing audible: no timer, no nodes
    pending.push(eventId)
    if (handle == null) handle = timers.set(flush, COALESCE_MS)
  } catch { /* never throw */ }
}
export const flushNow = () => { if (handle != null) timers.clear(handle); return flush() }

// ── previews (Settings → Sounds) ─────────────────────────────────────────
// Preview ignores the per-event switch, coalescing and the rate limit, but still honours master volume.
export function previewSound(soundId, { volume = 1, pack } = {}) {
  const cfg = getConfig()
  return playNow({ sound: soundId, volume: clamp01(volume * clamp01((cfg.volume ?? 80) / 100)), pack: pack || cfg.pack })
}
export function previewEvent(eventId) {
  const cfg = getConfig()
  const def = EVENTS_BY_ID[eventId]
  if (!def) return 0
  const ev = cfg.events?.[eventId] || {}
  const sound = ev.sound && ev.sound !== 'default' && SOUNDS[ev.sound] ? ev.sound : def.sound
  return previewSound(sound, { volume: clamp01((ev.volume ?? 100) / 100) })
}
// Plays every live event one after another; returns total length in seconds.
export function testAll(gap = 0.25) {
  const cfg = getConfig()
  const c = audio()
  if (!c) return 0
  let at = 0
  for (const def of LIVE_EVENTS) {
    const ev = cfg.events?.[def.id] || {}
    const sound = ev.sound && ev.sound !== 'default' && SOUNDS[ev.sound] ? ev.sound : def.sound
    playNow({ sound, volume: clamp01((cfg.volume ?? 80) / 100) * clamp01((ev.volume ?? 100) / 100), pack: cfg.pack }, at)
    at += soundDuration(sound) + gap
  }
  return at
}
