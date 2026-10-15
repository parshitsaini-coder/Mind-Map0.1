// Phase 13 — how much motion is allowed right now. Pure. The settings live in chartSettings.anim; this turns
// them (plus the system "reduce motion" preference and the adaptive downgrade) into a few flags the UI reads.
export const REDUCED_FADE_MS = 120

// mode: full | reduced | off · popup: full | toast | off
export function effectiveMode(anim, { prefersReduced = false, adaptive = false } = {}) {
  let m = anim.mode
  if (m === 'full' && anim.matchSystem && prefersReduced) m = 'reduced'
  if (m === 'full' && adaptive) m = 'reduced'
  return m
}

export function motionFlags(anim, env = {}) {
  const mode = effectiveMode(anim, env)
  const full = mode === 'full'
  return {
    mode,
    full,
    reduced: mode === 'reduced',
    off: mode === 'off',
    // Animations Off still shows plain toasts, never the animated popup
    popup: mode === 'off' && anim.popup === 'full' ? 'toast' : anim.popup,
    alsoToast: !!anim.alsoToast,
    popupMs: Math.round(anim.popupSeconds * 1000),
    fx: !!anim.chartFx && mode !== 'off',
    particles: full && !!anim.particles,
    shake: full && !!anim.shake,
    vignette: full && !!anim.chartFx,
    rows: mode !== 'off' && !!anim.rows,
    spring: full,
    fadeMs: REDUCED_FADE_MS,
  }
}

// Should the plain toast be shown for an event of this kind?  Errors are never hidden.
export function showToast(flags, kind) {
  if (kind === 'error') return true
  if (flags.popup === 'off') return false
  if (flags.popup === 'full') return flags.alsoToast
  return true
}

// Frame-time watchdog for the chart effects loop: feed it the time between frames while effects run.
// If the average over `windowMs` is above `limitMs`, say so once.
export function createFrameWatch({ limitMs = 24, windowMs = 1000 } = {}) {
  let sum = 0, n = 0, span = 0, tripped = false
  return {
    push(dt) {
      if (tripped || !(dt > 0) || dt > 500) return false // ignore gaps (tab hidden, first frame)
      sum += dt; n++; span += dt
      if (span < windowMs) return false
      const avg = sum / n
      sum = 0; n = 0; span = 0
      if (avg > limitMs) { tripped = true; return true }
      return false
    },
    reset() { sum = 0; n = 0; span = 0; tripped = false },
  }
}
