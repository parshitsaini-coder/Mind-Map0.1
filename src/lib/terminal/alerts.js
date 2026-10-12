// Sound + browser notification for fills. Everything is best-effort and never throws.
let ctx
const TONES = { win: [660, 880], loss: [330, 247], info: [587, 587], error: [247, 247] }

export function beep(kind = 'info') {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') ctx.resume()
    const [a, b] = TONES[kind] || TONES.info
    const t0 = ctx.currentTime
    ;[a, b].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, t0 + i * 0.12)
      g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.12 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.11)
      o.start(t0 + i * 0.12)
      o.stop(t0 + i * 0.12 + 0.12)
    })
  } catch { /* audio blocked or unavailable */ }
}

export const notifSupported = () => typeof Notification !== 'undefined'
export const notifPermission = () => (notifSupported() ? Notification.permission : 'denied')

export async function askNotifPermission() {
  try { return notifSupported() ? await Notification.requestPermission() : 'denied' } catch { return 'denied' }
}

// Only pops an OS notification when the tab is in the background.
export function osNotify(text) {
  try {
    if (notifPermission() === 'granted' && typeof document !== 'undefined' && document.hidden) {
      new Notification('Demo terminal', { body: text, tag: 'terminal-fill' })
    }
  } catch { /* ignore */ }
}
