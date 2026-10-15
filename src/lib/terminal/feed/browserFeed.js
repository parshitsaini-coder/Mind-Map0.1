// The single browser-side feed (Phase 14): one client + one polling hub, plus a small candle cache.
// Replaces simulatedFeed.js. Everything goes through same-origin /api/*.
import { createLiveClient } from './liveClient.js'
import { createLiveHub } from './liveHub.js'
import { mergeCandles } from './candleMath.js'
import { TF_SECONDS } from './symbolMap.js'

export const client = createLiveClient()
export const hub = createLiveHub({ client })

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) hub.resume() })
  if (typeof window !== 'undefined') window.addEventListener('online', () => hub.resume())
}

// ── candles: memory cache per symbol / timeframe; the newest (forming) bar is always refetched ──
const cache = new Map() // key -> { candles, at }
const pending = new Map()
const key = (s, tf) => `${s}|${tf}`

export async function getCandles(symbol, tf, { limit = 500, force = false } = {}) {
  const k = key(symbol, tf)
  const hit = cache.get(k)
  const fresh = hit && Date.now() - hit.at < Math.min(30000, TF_SECONDS[tf] * 250) && hit.candles.length >= Math.min(limit, 50)
  if (fresh && !force) return hit.candles
  if (pending.has(k)) return pending.get(k)
  const p = client.getCandles(symbol, tf, { limit }).then(({ candles }) => {
    const merged = hit ? mergeCandles(hit.candles, candles) : candles
    cache.set(k, { candles: merged, at: Date.now() })
    return merged
  }).finally(() => pending.delete(k))
  pending.set(k, p)
  return p
}
export const cachedCandles = (symbol, tf) => cache.get(key(symbol, tf))?.candles || null

// Older history (scroll-left): candles that end before `to` (UTC seconds).
export async function getCandlesBefore(symbol, tf, to, limit = 500) {
  const { candles } = await client.getCandles(symbol, tf, { limit, to: to - 1 })
  const k = key(symbol, tf)
  const hit = cache.get(k)
  if (hit) cache.set(k, { candles: mergeCandles(hit.candles, candles), at: hit.at })
  return candles
}

// "Day change" reference: the previous daily close from D1 candles (null until loaded / on error).
const dayRef = new Map()
export async function getDayOpen(symbol) {
  if (dayRef.has(symbol)) return dayRef.get(symbol)
  try {
    const c = await getCandles(symbol, 'D1', { limit: 5 })
    const v = c.length >= 2 ? c[c.length - 2].close : c.length ? c[0].open : null
    dayRef.set(symbol, v)
    return v
  } catch { return null }
}
export const clearFeedCache = () => { cache.clear(); dayRef.clear() }
