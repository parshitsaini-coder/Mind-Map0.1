// Tiny sound helper for the terminal (WebAudio, no files). Browsers only allow
// audio after a user gesture — the person has always clicked by then.
let ctx = null
const TONES = { win: [880, 1175], loss: [330, 247], fill: [660, 880], info: [720], error: [220] }

export function playSound(kind = 'info') {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const notes = TONES[kind] || TONES.info
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.12
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.2)
    })
  } catch { /* audio unavailable — toasts still show */ }
}

const KEY = 'mindmap-terminal-lastseen'
export const touchLastSeen = () => {
  try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
}
export const readLastSeen = () => {
  try { return Number(localStorage.getItem(KEY)) || null } catch { return null }
}
