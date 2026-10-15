// Phase 12 — sound design as DATA. Every sound is a list of notes; `playSound` is the one pure function
// that turns a note list into Web Audio nodes. No audio files anywhere. No imports.
//
// note: { f: Hz | [fromHz, toHz] (glide), t: start offset s, d: duration s, g: peak gain 0..1, w?: wave, lp?: low-pass Hz }
// Peak gain per note is kept <= PEAK so no sound (alarm included) is ever louder than the master volume allows.
export const PEAK = 0.22

export const SOUNDS = {
  buy: { label: 'Rising chirp', notes: [{ f: 660, t: 0, d: 0.09, g: 0.8 }, { f: 880, t: 0.08, d: 0.12, g: 0.9 }] },
  sell: { label: 'Falling chirp', notes: [{ f: 620, t: 0, d: 0.09, g: 0.8 }, { f: 440, t: 0.08, d: 0.14, g: 0.9 }] },
  tick: { label: 'Soft tick', notes: [{ f: 1200, t: 0, d: 0.04, g: 0.5, w: 'sine' }] },
  arpeggio: { label: 'Bright arpeggio', notes: [{ f: 523, t: 0, d: 0.1, g: 0.7 }, { f: 659, t: 0.09, d: 0.1, g: 0.75 }, { f: 784, t: 0.18, d: 0.18, g: 0.85 }] },
  blip: { label: 'Tiny blip', notes: [{ f: 900, t: 0, d: 0.035, g: 0.45, w: 'sine' }] },
  thud: { label: 'Soft thud', notes: [{ f: [160, 90], t: 0, d: 0.16, g: 0.9, w: 'sine', lp: 400 }] },
  buzz: { label: 'Dull double buzz', notes: [{ f: 150, t: 0, d: 0.1, g: 0.8, w: 'sawtooth', lp: 600 }, { f: 150, t: 0.16, d: 0.12, g: 0.8, w: 'sawtooth', lp: 600 }] },
  chime: { label: 'Rising chime + sparkle', notes: [{ f: 784, t: 0, d: 0.14, g: 0.7, w: 'sine' }, { f: 1047, t: 0.1, d: 0.16, g: 0.75, w: 'sine' }, { f: 1319, t: 0.2, d: 0.3, g: 0.8, w: 'sine' }, { f: 2637, t: 0.24, d: 0.12, g: 0.25, w: 'sine' }, { f: 3136, t: 0.3, d: 0.14, g: 0.2, w: 'sine' }] },
  descend: { label: 'Descending low tone', notes: [{ f: [330, 196], t: 0, d: 0.32, g: 0.9, w: 'triangle', lp: 900 }, { f: [196, 130], t: 0.24, d: 0.36, g: 0.8, w: 'triangle', lp: 700 }] },
  flat: { label: 'Neutral double tick', notes: [{ f: 520, t: 0, d: 0.06, g: 0.5, w: 'sine' }, { f: 520, t: 0.1, d: 0.06, g: 0.5, w: 'sine' }] },
  partial: { label: 'Half chime', notes: [{ f: 740, t: 0, d: 0.1, g: 0.6, w: 'sine' }, { f: 988, t: 0.09, d: 0.12, g: 0.55, w: 'sine' }] },
  alarm: { label: 'Urgent alarm', notes: [0, 0.22, 0.44, 0.66].map((t, i) => ({ f: i % 2 ? 780 : 1040, t, d: 0.18, g: 1, w: 'square', lp: 2400 })) },
  bell: { label: 'Bell', notes: [{ f: 1568, t: 0, d: 0.6, g: 0.7, w: 'sine' }, { f: 2349, t: 0, d: 0.45, g: 0.3, w: 'sine' }, { f: 3136, t: 0, d: 0.3, g: 0.15, w: 'sine' }] },
  reverse: { label: 'Flip', notes: [{ f: [400, 800], t: 0, d: 0.1, g: 0.7 }, { f: [800, 400], t: 0.1, d: 0.1, g: 0.7 }] },
  linkdown: { label: 'Link down', notes: [{ f: 440, t: 0, d: 0.12, g: 0.7, w: 'sine' }, { f: 294, t: 0.14, d: 0.2, g: 0.7, w: 'sine' }] },
  linkup: { label: 'Link up', notes: [{ f: 294, t: 0, d: 0.1, g: 0.6, w: 'sine' }, { f: 440, t: 0.1, d: 0.16, g: 0.6, w: 'sine' }] },
  click: { label: 'Click', notes: [{ f: 1800, t: 0, d: 0.02, g: 0.35, w: 'square', lp: 3000 }] },
  toggle: { label: 'Toggle', notes: [{ f: 1000, t: 0, d: 0.03, g: 0.4, w: 'sine' }, { f: 1400, t: 0.035, d: 0.03, g: 0.4, w: 'sine' }] },
}
export const SOUND_IDS = Object.keys(SOUNDS)

// Packs are data tables: `wave` replaces the oscillator type (null = keep each note's own), `gain` scales
// loudness, `lp` caps the low-pass, `only` (optional) lists the only events that may sound at all.
export const PACKS = {
  classic: { label: 'Classic', wave: null, gain: 1, lp: null },
  soft: { label: 'Soft', wave: 'sine', gain: 0.6, lp: 2200 },
  arcade: { label: 'Arcade', wave: 'square', gain: 0.5, lp: null },
  silentpro: { label: 'Silent pro (only SL / TP / stop-out)', wave: null, gain: 1, lp: null, only: ['position.sl.hit', 'position.tp.hit', 'account.stopout'] },
}
export const PACK_IDS = Object.keys(PACKS)

const WAVES = ['sine', 'square', 'sawtooth', 'triangle']

// A pack is valid when it has a known wave, a gain in (0, 1.5] and (if present) `only` is an array of strings.
export function validatePack(p) {
  if (!p || typeof p !== 'object') return false
  if (p.wave != null && !WAVES.includes(p.wave)) return false
  if (!(typeof p.gain === 'number' && p.gain > 0 && p.gain <= 1.5)) return false
  if (p.lp != null && !(typeof p.lp === 'number' && p.lp >= 200 && p.lp <= 20000)) return false
  if (p.only != null && !(Array.isArray(p.only) && p.only.every((x) => typeof x === 'string'))) return false
  return true
}

export function validateSound(def) {
  if (!def || !Array.isArray(def.notes) || !def.notes.length) return false
  return def.notes.every((n) => {
    const fs = Array.isArray(n.f) ? n.f : [n.f]
    return fs.every((f) => typeof f === 'number' && f >= 20 && f <= 12000) && n.t >= 0 && n.d > 0 && n.d <= 2 && n.g > 0 && n.g <= 1 && (n.w == null || WAVES.includes(n.w))
  })
}

export const soundDuration = (id) => {
  const d = SOUNDS[id]
  return d ? Math.max(...d.notes.map((n) => n.t + n.d)) : 0
}

// Schedule one sound on `ctx` starting at `when` (ctx time). `volume` is 0..1 (master × event).
// Returns the number of oscillators created — 0 for an unknown sound or volume 0, so a muted sound costs nothing.
export function playSound(ctx, soundId, when, volume, packId = 'classic') {
  const def = SOUNDS[soundId]
  const pack = PACKS[packId] || PACKS.classic
  const vol = Math.min(1, Math.max(0, Number(volume) || 0))
  if (!def || vol <= 0) return 0
  let n = 0
  for (const note of def.notes) {
    const t0 = when + note.t
    const peak = Math.min(PEAK, PEAK * note.g * pack.gain) * vol
    if (peak <= 0.0002) continue
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = pack.wave || note.w || 'square'
    const [f0, f1] = Array.isArray(note.f) ? note.f : [note.f, note.f]
    osc.frequency.setValueAtTime(f0, t0)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + note.d)
    let tail = osc
    const cut = note.lp && pack.lp ? Math.min(note.lp, pack.lp) : note.lp || pack.lp
    if (cut) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(cut, t0)
      osc.connect(lp)
      tail = lp
    }
    tail.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, note.d / 3))
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.d)
    osc.start(t0)
    osc.stop(t0 + note.d + 0.02)
    n++
  }
  return n
}
