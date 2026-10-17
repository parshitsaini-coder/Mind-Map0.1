// Pure helpers for connection health: stale detection state machine + retry backoff.
export const STALE_AFTER_SEC = 90 // no fresh price this long while the market is open -> delayed
export const OFFLINE_AFTER_SEC = 300 // ... -> offline

// -> 'live' | 'delayed' | 'offline' | 'closed' | 'loading'
export function connectionState({ now, lastUpdate, marketOpen, failures = 0, everLoaded = true }) {
  if (!everLoaded && lastUpdate == null) return failures > 0 ? 'offline' : 'loading'
  if (!marketOpen) return 'closed'
  if (lastUpdate == null) return failures > 0 ? 'offline' : 'loading'
  const age = now - lastUpdate
  if (age >= OFFLINE_AFTER_SEC) return 'offline'
  if (age >= STALE_AFTER_SEC || failures >= 2) return 'delayed'
  return 'live'
}
// Prices are safe to trigger SL/TP/pending only when the state is 'live'.
export const canTrigger = (state) => state === 'live'

// Exponential backoff with full jitter. rnd in [0,1). Quota errors back off much longer.
export function backoffMs(attempt, { base = 2000, cap = 60000, quota = false, rnd = Math.random() } = {}) {
  if (quota) return Math.min(15 * 60000, 120000 * 2 ** Math.min(attempt, 3)) // 2, 4, 8, 15 min
  const ceil = Math.min(cap, base * 2 ** Math.min(attempt, 10))
  return Math.round(ceil / 2 + (ceil / 2) * rnd)
}
