// Sounds as DATA (Phase 12). A sound is a list of notes; `playSound` turns one into Web Audio nodes.
// No audio files. playSound only needs the small AudioContext surface used below, so tests pass a stub.
//
// note: { f: Hz, at: start offset (s), d: length (s), f2?: glide target Hz, g?: relative level 0..1 }
// def:  { id, name, wave, notes, filter?: { type, freq }, urgent?: true }
const n = (f, at, d, extra = {}) => ({ f, at, d, ...extra })

export const SOUNDS = [
  { id: 'buy', name: 'Rising chirp', wave: 'triangle', notes: [n(523, 0, 0.1), n(784, 0.09, 0.14)] },
  { id: 'sell', name: 'Falling chirp', wave: 'triangle', notes: [n(784, 0, 0.1), n(523, 0.09, 0.14)] },
  { id: 'tick', name: 'Soft tick', wave: 'sine', notes: [n(1000, 0, 0.05, { g: 0.6 })] },
  { id: 'arpeggio', name: 'Bright arpeggio', wave: 'triangle', notes: [n(659, 0, 0.12), n(784, 0.08, 0.12), n(1047, 0.16, 0.2)] },
  { id: 'blip', name: 'Tiny blip', wave: 'sine', notes: [n(880, 0, 0.06, { g: 0.5 })] },
  { id: 'thud', name: 'Soft thud', wave: 'sine', notes: [n(130, 0, 0.2, { f2: 60 })], filter: { type: 'lowpass', freq: 420 } },
  { id: 'buzz', name: 'Dull buzz', wave: 'sawtooth', notes: [n(150, 0, 0.1, { g: 0.7 }), n(150, 0.14, 0.1, { g: 0.7 })], filter: { type: 'lowpass', freq: 650 } },
  { id: 'chime', name: 'Sparkle chime', wave: 'sine', notes: [n(784, 0, 0.3), n(988, 0.09, 0.3), n(1175, 0.18, 0.4), n(2349, 0.26, 0.18, { g: 0.3 }), n(2794, 0.32, 0.2, { g: 0.25 })] },
  { id: 'descend', name: 'Low descent', wave: 'triangle', notes: [n(392, 0, 0.45, { f2: 196 })], filter: { type: 'lowpass', freq: 900 } },
  { id: 'alarm', name: 'Urgent alarm', wave: 'square', urgent: true, notes: [n(880, 0, 0.11), n(660, 0.14, 0.11), n(880, 0.28, 0.11), n(660, 0.42, 0.11), n(880, 0.56, 0.11)], filter: { type: 'lowpass', freq: 2600 } },
  { id: 'warn', name: 'Warning beeps', wave: 'square', urgent: true, notes: [n(660, 0, 0.13, { g: 0.8 }), n(660, 0.2, 0.13, { g: 0.8 })], filter: { type: 'lowpass', freq: 2200 } },
  { id: 'bell', name: 'Bell', wave: 'sine', notes: [n(1318, 0, 0.9), n(2636, 0, 0.6, { g: 0.3 }), n(3951, 0, 0.35, { g: 0.1 })] },
  { id: 'step', name: 'Double step', wave: 'sine', notes: [n(660, 0, 0.06, { g: 0.7 }), n(660, 0.08, 0.06, { g: 0.7 })] },
  { id: 'flip', name: 'Flip', wave: 'triangle', notes: [n(600, 0, 0.09, { f2: 900 }), n(900, 0.1, 0.1, { f2: 600 })] },
  { id: 'click', name: 'Click', wave: 'sine', notes: [n(1800, 0, 0.02, { g: 0.4 })] },
]
export const SOUND_IDS = SOUNDS.map((s) => s.id)
export const SOUND_BY_ID = Object.fromEntries(SOUNDS.map((s) => [s.id, s]))

// Packs are data too. wave: null keeps each sound's own waveform. gain scales the level (urgent sounds never drop below 0.9).
// only: if set, just these events make a sound (the "Silent pro" pack).
export const PACKS = [
  { id: 'classic', name: 'Classic', hint: 'Balanced, a little retro', wave: null, gain: 1, only: null },
  { id: 'soft', name: 'Soft', hint: 'Rounded sine tones, quieter', wave: 'sine', gain: 0.7, only: null },
  { id: 'arcade', name: 'Arcade', hint: 'Punchy square waves', wave: 'square', gain: 0.5, only: null },
  { id: 'silent', name: 'Silent pro', hint: 'Only SL, TP, margin and stop-out', wave: null, gain: 1, only: ['position.sl.hit', 'position.tp.hit', 'account.margin.warning', 'account.stopout'] },
]
export const PACK_IDS = PACKS.map((p) => p.id)
export const PACK_BY_ID = Object.fromEntries(PACKS.map((p) => [p.id, p]))

export const LEVEL = 0.3 // loudest a sound can get at volume 1 (kept low: oscillators are loud)

// Length of a sound in seconds (used to know when its nodes are done).
export const soundLength = (def) => def.notes.reduce((m, x) => Math.max(m, x.at + x.d), 0)

// Plays one sound. `volume` is the final 0..1 level (master x event). Returns the number of oscillators
// created (0 when silent). Never louder than volume x LEVEL, so an alarm cannot exceed the master volume.
export function playSound(ctx, def, when, volume, pack = PACKS[0]) {
  const vol = Math.min(1, Math.max(0, Number(volume) || 0))
  if (!ctx || !def || vol <= 0) return 0
  const pg = def.urgent ? Math.max(pack.gain, 0.9) : pack.gain
  const wave = def.urgent ? def.wave : (pack.wave || def.wave)
  let made = 0
  for (const note of def.notes) {
    const peak = LEVEL * vol * pg * (note.g ?? 1)
    if (peak <= 0) continue
    const t0 = when + note.at
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = wave
    o.frequency.setValueAtTime(note.f, t0)
    if (note.f2) o.frequency.exponentialRampToValueAtTime(note.f2, t0 + note.d)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, note.d / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + note.d)
    o.connect(g)
    if (def.filter && ctx.createBiquadFilter) {
      const f = ctx.createBiquadFilter()
      f.type = def.filter.type
      f.frequency.value = def.filter.freq
      g.connect(f)
      f.connect(ctx.destination)
    } else g.connect(ctx.destination)
    o.start(t0)
    o.stop(t0 + note.d + 0.02)
    made++
  }
  return made
}
