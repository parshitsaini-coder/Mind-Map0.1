// Runtime motion flags: does the OS ask for reduced motion, and did the frame governor drop us to reduced mode.
// Tiny external store (React reads it with useSyncExternalStore).
let adaptive = false
let notified = false
const subs = new Set()
const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null)
export const systemReduced = () => { try { return !!(mq() && mq().matches) } catch { return false } }
export const getMotionFlags = () => ({ systemReduced: systemReduced(), adaptive })
export const motionKey = () => `${systemReduced() ? 1 : 0}${adaptive ? 1 : 0}`
export function subscribeMotion(fn) {
  subs.add(fn)
  let m = null
  try { m = mq(); m && m.addEventListener('change', fn) } catch { /* old browsers */ }
  return () => { subs.delete(fn); try { m && m.removeEventListener('change', fn) } catch { /* ignore */ } }
}
// Called once by the effects canvas when frames stay slow. Returns true the first time (caller tells the user).
export function setAdaptiveReduced() {
  adaptive = true
  subs.forEach((f) => f())
  if (notified) return false
  notified = true
  return true
}
export const _resetMotion = () => { adaptive = false; notified = false }
