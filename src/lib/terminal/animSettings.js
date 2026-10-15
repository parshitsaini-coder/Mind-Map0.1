// Pure animation settings (Phase 13): defaults for chartSettings.anim, validation tables merged into
// chartSettings.js, and the ONE function that decides how much motion to use right now.
export const ANIM_MODES = ['full', 'reduced', 'off']

export function defaultAnim() {
  return {
    mode: 'full', // full | reduced | off  (off = plain toasts, no motion at all)
    matchSystem: true, // follow the OS "reduce motion" switch (-> reduced)
    popup: 'full', // full = the "Done" card | toast = toast only
    seconds: 2, // popup life, 1..4 s
    position: 'top', // top | bottom
    alsoToast: true, // keep the toast next to the popup
    confetti: false, // a new best trade
    rows: true, // Positions / Orders / History rows enter, leave, re-order
    flash: true, // price / P&L digits flash on change
    fx: { open: true, trigger: true, tp: true, sl: true, margin: true, stopout: true, alert: true, other: true },
  }
}
export const ANIM_ENUMS = { 'anim.mode': ANIM_MODES, 'anim.popup': ['full', 'toast'], 'anim.position': ['top', 'bottom'] }
export const ANIM_RANGES = { 'anim.seconds': [1, 4] }

// anim: chartSettings.anim.  env: { systemReduced, degraded }  ->  'full' | 'reduced' | 'off'
export function effectiveMode(anim, env = {}) {
  if (!anim || anim.mode === 'off') return 'off'
  if (anim.mode === 'reduced') return 'reduced'
  if (anim.matchSystem && env.systemReduced) return 'reduced'
  if (env.degraded) return 'reduced'
  return 'full'
}

// Does this event still get a toast? Only when it has no popup, or the popup is off / "toast only", or "also show toast" is on.
export function toastWanted(anim, mode, hasPopup) {
  if (!anim || mode === 'off' || !hasPopup) return true
  return anim.popup !== 'full' || !!anim.alsoToast
}
// The OS "reduce motion" switch (false when it cannot be read).
export const prefersReduced = () => {
  try { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
