// Connection health (Phase 14): when is a feed live / delayed / offline, how long to wait before retrying, how fast we may poll
// without burning the provider's credits, and which ticks to accept. All pure, clock and randomness injected.
export const thresholdsFor = (pollMs) => ({ delayedMs: Math.max(15000, pollMs * 3), offlineMs: Math.max(45000, pollMs * 8) })

// marketOpen === false overrides everything: a quiet closed market is not an outage.
export function freshnessOf({ now, lastTickMs, marketOpen = true, started = true, pollMs = 5000, failures = 0 }) {
  if (marketOpen === false) return 'closed'
  if (lastTickMs == null) return started && failures === 0 ? 'connecting' : 'offline'
  const age = now - lastTickMs
  const t = thresholdsFor(pollMs)
  if (age >= t.offlineMs) return 'offline'
  if (age >= t.delayedMs) return 'delayed'
  return 'live'
}

// Exponential backoff with jitter: attempt 0 -> ~base, doubling to max; half fixed, half random so clients do not stampede.
export function backoffMs(attempt, { base = 1000, max = 60000, rng = Math.random } = {}) {
  const exp = Math.min(max, base * 2 ** Math.max(0, attempt))
  return Math.round(exp / 2 + rng() * (exp / 2))
}

// How often may we poll N symbols if the plan allows `perMinute` credits and we want to keep `headroom` of it free (history
// requests, a second tab)? Never faster than minMs.  5 symbols on the free plan (8 / min) -> about once a minute.
export function pollIntervalMs(nSymbols, perMinute, { headroom = 0.6, minMs = 5000, maxMs = 300000 } = {}) {
  if (!(nSymbols > 0) || !(perMinute > 0)) return maxMs
  return Math.min(maxMs, Math.max(minMs, Math.ceil(Math.round((nSymbols / (perMinute * headroom)) * 60000 * 1000) / 1000)))
}

// De-duplicate and order ticks: returns true when the tick should be applied. A tick older than the newest one is dropped; an
// identical repeat (same ts, same price) is dropped.
export function acceptTick(prev, tick) {
  if (!tick || !Number.isFinite(tick.last)) return false
  if (!prev) return true
  const a = prev.ts ?? 0, b = tick.ts ?? Infinity
  if (b < a) return false
  if (b === a && tick.last === prev.last && tick.bid === prev.bid && tick.ask === prev.ask) return false
  return true
}
