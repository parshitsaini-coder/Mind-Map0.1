// Adaptive guard (Phase 13): if frames stay slower than `limitMs` for a whole `windowMs`, call onDegrade ONCE.
// Fed only while an effect is on screen. Gaps over 2 s (debugger, suspended tab) are ignored; a hidden tab never feeds it (ChartFx stops the loop).
export function createFrameGuard({ limitMs = 24, windowMs = 1000, onDegrade } = {}) {
  let slow = 0
  let fired = false
  return {
    frame(dt) {
      if (fired || !(dt > 0) || dt > 2000) { slow = 0; return fired }
      if (dt > limitMs) slow += dt
      else slow = 0
      if (slow >= windowMs) { fired = true; try { onDegrade && onDegrade() } catch { /* ignore */ } }
      return fired
    },
    reset() { slow = 0; fired = false },
    get degraded() { return fired },
  }
}
