// Proxy guard rails (Phase 14), pure so they can be tested: validate + clamp query strings against the symbol allow-list, a per-IP
// rate limiter, a per-provider credit budget, edge-cache policy and CORS. Used by api/*.js. No secrets in here.
import { isAllowed, TF_SECONDS, TF_IDS } from './symbolMap.js'
import { feedError } from './adapters/errors.js'

export const LIMITS = { maxCandles: 5000, defaultCandles: 500, maxSymbols: 8, maxRangeDays: 3650 }
const intOf = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.floor(n) : NaN }
const first = (v) => (Array.isArray(v) ? v[0] : v)

// -> { symbol, tf, from, to, limit } or throws a FeedError. from / to are UTC seconds; to defaults to now, limit to 500.
export function parseCandlesQuery(q, nowSec) {
  const symbol = String(first(q.symbol) || '')
  if (!isAllowed(symbol)) throw feedError('unsupported_symbol', 'Unknown symbol')
  const tf = String(first(q.tf) || '')
  if (!TF_IDS.includes(tf)) throw feedError('bad_request', 'Unknown timeframe')
  let to = q.to == null ? nowSec : intOf(first(q.to))
  let from = q.from == null ? null : intOf(first(q.from))
  let limit = q.limit == null ? LIMITS.defaultCandles : intOf(first(q.limit))
  if (Number.isNaN(to) || Number.isNaN(limit) || (from != null && Number.isNaN(from))) throw feedError('bad_request', 'Bad number in the request')
  to = Math.min(to, nowSec + 60)
  limit = Math.min(LIMITS.maxCandles, Math.max(1, limit))
  if (from != null) {
    if (from >= to) throw feedError('bad_request', 'from must be before to')
    from = Math.max(from, to - LIMITS.maxRangeDays * 86400)
  }
  return { symbol, tf, from, to, limit }
}

// ?symbols=EURUSD,XAUUSD  -> de-duplicated allow-listed list (max 8) or a FeedError
export function parseQuoteQuery(q) {
  const raw = String(first(q.symbols) || first(q.symbol) || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!raw.length) throw feedError('bad_request', 'No symbols given')
  const uniq = [...new Set(raw)]
  if (uniq.length > LIMITS.maxSymbols) throw feedError('bad_request', `At most ${LIMITS.maxSymbols} symbols per request`)
  const bad = uniq.find((s) => !isAllowed(s))
  if (bad) throw feedError('unsupported_symbol', 'Unknown symbol')
  return uniq
}

// Sliding-window limiter. take(key, nowMs) -> { ok, retryAfter }. Memory is bounded: old keys are swept.
export function createRateLimiter({ limit = 60, windowMs = 60000, maxKeys = 5000 } = {}) {
  const hits = new Map()
  return {
    take(key, now) {
      const arr = (hits.get(key) || []).filter((t) => now - t < windowMs)
      if (arr.length >= limit) { hits.set(key, arr); return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - arr[0])) / 1000)) } }
      arr.push(now); hits.set(key, arr)
      if (hits.size > maxKeys) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] >= windowMs) hits.delete(k)
      return { ok: true, retryAfter: 0 }
    },
    get size() { return hits.size },
  }
}

// Credits we may still spend upstream: a per-minute and a per-day bucket. Best effort per server instance; the edge cache
// (s-maxage) is what really shares the budget between users.
export function createCreditBudget({ perMinute, perDay = Infinity }) {
  let minute = { id: -1, used: 0 }, day = { id: -1, used: 0 }
  const roll = (now) => {
    const m = Math.floor(now / 60000), d = Math.floor(now / 86400000)
    if (minute.id !== m) minute = { id: m, used: 0 }
    if (day.id !== d) day = { id: d, used: 0 }
  }
  return {
    // -> { ok } or { ok:false, code:'rate_limited'|'quota', retryAfter }
    spend(n, now) {
      roll(now)
      if (day.used + n > perDay) return { ok: false, code: 'quota', retryAfter: Math.ceil(((day.id + 1) * 86400000 - now) / 1000) }
      if (minute.used + n > perMinute) return { ok: false, code: 'rate_limited', retryAfter: Math.ceil(((minute.id + 1) * 60000 - now) / 1000) }
      minute.used += n; day.used += n
      return { ok: true }
    },
    usage(now) { roll(now); return { minute: minute.used, day: day.used } },
  }
}

// Cache-Control for the edge. Finished history never changes; the forming bar and quotes live for a few seconds.
export function cachePolicy({ kind, tfSec = 60, toSec = 0, nowSec = 0, quoteTtl = 5 }) {
  if (kind === 'quote') return `public, s-maxage=${quoteTtl}, stale-while-revalidate=${quoteTtl * 3}`
  if (kind === 'symbols') return 'public, s-maxage=86400, stale-while-revalidate=604800'
  if (kind === 'candles') {
    if (nowSec - toSec > tfSec * 2) return 'public, s-maxage=86400, stale-while-revalidate=604800, immutable' // history is final
    return `public, s-maxage=${Math.min(10, Math.max(2, Math.floor(tfSec / 6)))}, stale-while-revalidate=30`
  }
  return 'no-store'
}

// Same-origin requests carry no Origin header and need nothing. A cross-origin browser call is allowed only for ALLOWED_ORIGIN.
export function corsHeaders(origin, allowed) {
  const list = String(allowed || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!origin) return { ok: true, headers: {} }
  if (!list.includes(origin)) return { ok: false, headers: {} }
  return { ok: true, headers: { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } }
}
export const clientIp = (headers) => String((headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown')).split(',')[0].trim()
export { TF_SECONDS }
