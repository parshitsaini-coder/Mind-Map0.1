// Pure sound logic (Phase 12): defaults for chartSettings.sounds, deciding whether / how an event plays,
// coalescing, and the migration of the old on/off switch. No audio and no imports from chartSettings.
import { EVENTS, EVENT_BY_ID, evKey } from './eventCatalog.js'
import { SOUND_IDS, PACK_IDS, PACK_BY_ID } from './soundDefs.js'

export const COALESCE_MS = 100
export const MAX_SOUNDS_PER_SEC = 6

export function defaultSounds() {
  const ev = {}
  for (const e of EVENTS) ev[evKey(e.id)] = { on: e.on, vol: 1, sound: 'default' }
  return { master: true, volume: 0.7, bgMute: true, vibrate: true, pack: 'classic', ev }
}

// Validation tables merged into chartSettings.js (its clean() reads them by dotted path).
export const SOUND_ENUMS = { 'sounds.pack': PACK_IDS }
export const SOUND_RANGES = { 'sounds.volume': [0, 1] }
for (const e of EVENTS) {
  SOUND_ENUMS[`sounds.ev.${evKey(e.id)}.sound`] = ['default', ...SOUND_IDS]
  SOUND_RANGES[`sounds.ev.${evKey(e.id)}.vol`] = [0, 1]
}

// Decides what an event does right now. Returns null (silent) or { soundId, volume, pack }.
// `hidden` = the tab is in the background. Called at play time, so a setting change applies at once.
export function soundPlan(cs, eventId, hidden = false) {
  const s = cs && cs.sounds
  const def = EVENT_BY_ID[eventId]
  if (!s || !def || !s.master) return null
  const ev = s.ev && s.ev[evKey(eventId)]
  if (!ev || !ev.on) return null
  const pack = PACK_BY_ID[s.pack] || PACK_BY_ID.classic
  if (pack.only && !pack.only.includes(eventId)) return null
  if (hidden && s.bgMute) return null
  const volume = s.volume * ev.vol
  if (!(volume > 0)) return null
  const soundId = ev.sound && ev.sound !== 'default' && SOUND_IDS.includes(ev.sound) ? ev.sound : def.sound
  return { soundId, volume, pack, prio: def.prio, eventId }
}

// Vibration pattern for an event (null = none). Independent of the sound switches, but off when `vibrate` is off.
export const hapticFor = (cs, eventId) => (cs && cs.sounds && cs.sounds.vibrate && EVENT_BY_ID[eventId] ? EVENT_BY_ID[eventId].haptic : null)

// Events that arrive within `windowMs` of each other play ONE sound: the highest priority (ties: the later one).
// `perSec` caps how many sounds can start in any one second. Timestamps are passed in, so it is testable.
export function createCoalescer({ windowMs = COALESCE_MS, perSec = MAX_SOUNDS_PER_SEC } = {}) {
  let best = null
  let openAt = null
  const played = []
  return {
    // Returns true when this call opened a new window (the caller schedules flush() windowMs later).
    add(plan, now) {
      const opened = openAt === null
      if (opened) openAt = now
      if (!best || plan.prio >= best.prio) best = plan
      return opened
    },
    flush(now) {
      const out = best
      best = null
      openAt = null
      if (!out) return null
      while (played.length && now - played[0] >= 1000) played.shift()
      if (played.length >= perSec) return null
      played.push(now)
      return out
    },
  }
}

// Old saves had one boolean `settings.sound`. If the chart settings have no `sounds` yet, that boolean becomes
// the master switch, so someone who muted before stays muted. Returns a chart-settings-shaped object.
export function migrateSound(rawChart, oldSettings) {
  const base = rawChart && typeof rawChart === 'object' ? rawChart : {}
  if (base.sounds && typeof base.sounds === 'object') return base
  if (oldSettings && oldSettings.sound === false) return { ...base, sounds: { master: false } }
  return base
}
