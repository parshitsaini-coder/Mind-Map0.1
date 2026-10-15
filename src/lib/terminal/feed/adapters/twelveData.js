// Twelve Data adapter (Phase 14): URL builders + pure response normalisers. No network in here: the proxy passes the fetched
// JSON in, so every function is unit-testable. Shapes follow twelvedata.com/llms-full.txt (time_series, quote, error shape).
// NOTE: free plan = 8 credits / minute, 800 / day, 1 credit per symbol per request.
import { feedError } from './errors.js'

export const BASE = 'https://api.twelvedata.com'
export const INTERVAL = { M1: '1min', M5: '5min', M15: '15min', M30: '30min', H1: '1h', H4: '4h', D1: '1day', W1: '1week' }
export const MAX_OUTPUT = 5000

const iso = (sec) => new Date(sec * 1000).toISOString().slice(0, 19).replace('T', ' ')
export function candlesUrl(vendor, tf, { from, to, limit } = {}) {
  const p = new URLSearchParams({ symbol: vendor, interval: INTERVAL[tf], timezone: 'UTC', order: 'asc', outputsize: String(Math.min(MAX_OUTPUT, limit || 500)) })
  if (from) p.set('start_date', iso(from))
  if (to) p.set('end_date', iso(to))
  return `${BASE}/time_series?${p}`
}
export const quoteUrl = (vendors) => `${BASE}/quote?${new URLSearchParams({ symbol: vendors.join(','), interval: '1min' })}`
export const authHeaders = (key) => ({ Authorization: `apikey ${key}` })

// 'YYYY-MM-DD HH:MM:SS' (UTC because we ask timezone=UTC) or 'YYYY-MM-DD' -> seconds
export const parseTime = (s) => { const t = Date.parse(String(s).length > 10 ? `${String(s).replace(' ', 'T')}Z` : `${s}T00:00:00Z`); return Number.isFinite(t) ? Math.floor(t / 1000) : null }
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null }

// Twelve Data's error shape: { code, message, status: 'error' }
export function errorOf(json, httpStatus) {
  const code = Number(json?.code) || httpStatus
  const msg = String(json?.message || '').slice(0, 160)
  if (code === 429) return feedError(/day|daily/i.test(msg) ? 'quota' : 'rate_limited', /day|daily/i.test(msg) ? 'Daily data limit reached' : 'Price provider is busy, retrying', { retryAfter: /day|daily/i.test(msg) ? 3600 : 30 })
  if (code === 401) return feedError('auth', 'Price provider key was rejected')
  if (code === 403) return feedError('plan', 'This symbol is not included in the data plan')
  if (code === 400 || code === 404) return feedError('unsupported_symbol', 'Symbol or range not available from the provider')
  return feedError('upstream', 'Price provider error')
}

export function normalizeCandles(json, httpStatus = 200) {
  if (!json || json.status === 'error' || httpStatus >= 400) throw errorOf(json, httpStatus)
  if (!Array.isArray(json.values)) throw feedError('upstream', 'Unexpected response from the price provider')
  const out = []
  for (const v of json.values) {
    const time = parseTime(v.datetime), open = num(v.open), high = num(v.high), low = num(v.low), close = num(v.close)
    if (time == null || [open, high, low, close].some((x) => x == null)) continue // drop a malformed row, keep the rest
    out.push({ time, open, high, low, close, volume: num(v.volume) || 0 })
  }
  out.sort((a, b) => a.time - b.time)
  return out.filter((c, i) => i === 0 || c.time !== out[i - 1].time)
}

// interval=1min matters: without it /quote answers with the DAILY bar, whose timestamp is hours old (the day change comes from D1 candles).
// A quote for ONE symbol object -> Tick, or null if it has no usable price.
function tickOf(q) {
  const last = num(q?.close ?? q?.price)
  if (last == null || q?.status === 'error') return null
  const ts = num(q.timestamp)
  return { bid: num(q.bid), ask: num(q.ask), last, ts: ts ? ts * 1000 : null, source: 'twelvedata', marketOpen: typeof q.is_market_open === 'boolean' ? q.is_market_open : undefined }
}
// One symbol -> flat object; several -> an object keyed by vendor symbol. Returns { [vendorSymbol]: Tick | FeedError }.
export function normalizeQuotes(json, requested, httpStatus = 200) {
  if (!json || httpStatus >= 400 || (json.status === 'error' && !json[requested[0]])) throw errorOf(json, httpStatus)
  const out = {}
  const single = requested.length === 1 && (json.symbol || json.close || json.status === 'error')
  for (const v of requested) {
    const q = single ? json : json[v]
    out[v] = q ? (tickOf(q) || (q.status === 'error' ? errorOf(q, q.code) : feedError('upstream', 'No price available'))) : feedError('unsupported_symbol', 'Symbol not returned by the provider')
  }
  return out
}
