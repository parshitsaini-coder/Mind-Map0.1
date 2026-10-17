// Twelve Data adapter — PURE normalisation + a fetch wrapper with an injectable fetch (for tests).
// Runs only on the server (api/*); the key is passed in from process.env and is never logged.
import { FeedError, TF_INTERVAL } from '../feedTypes.js'

const BASE = 'https://api.twelvedata.com'
export const PROVIDER = 'Twelve Data'
export const PROVIDER_SYMBOLS = { XAUUSD: 'XAU/USD' }
export const toProviderSymbol = (s) => PROVIDER_SYMBOLS[s] || null

// "2026-10-14 13:05:00" (UTC, because we ask timezone=UTC) or "2026-10-14" -> UTC seconds
export function parseDatetime(s) {
  if (typeof s !== 'string') return NaN
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000
}

// Provider error body -> FeedError
export function toFeedError(body, httpStatus) {
  const code = Number(body?.code ?? httpStatus)
  const msg = String(body?.message || '')
  if (code === 429 || /run out of api credits|rate limit|too many/i.test(msg)) return new FeedError('QUOTA', 'Data provider quota reached — try again later')
  if (code === 401 || code === 403 || /apikey|api key/i.test(msg)) return new FeedError('NO_KEY', 'Data provider rejected the key')
  if (code === 400 || code === 404) return new FeedError('UPSTREAM', 'Data provider could not serve this request')
  return new FeedError('UPSTREAM')
}

// /time_series payload -> candles oldest first
export function normaliseCandles(body) {
  if (!body || body.status === 'error') throw toFeedError(body)
  const vals = Array.isArray(body.values) ? body.values : []
  const out = []
  for (const v of vals) {
    const time = parseDatetime(v.datetime)
    const open = parseFloat(v.open), high = parseFloat(v.high), low = parseFloat(v.low), close = parseFloat(v.close)
    if (![time, open, high, low, close].every(Number.isFinite) || high < low) continue
    out.push({ time, open, high, low, close, volume: Number.isFinite(parseFloat(v.volume)) ? parseFloat(v.volume) : 0 })
  }
  out.sort((a, b) => a.time - b.time)
  return out.filter((c, i) => i === 0 || c.time !== out[i - 1].time)
}
// /price payload -> { last, ts }
export function normalisePrice(body, now = Math.floor(Date.now() / 1000)) {
  if (!body || body.status === 'error') throw toFeedError(body)
  const last = parseFloat(body.price)
  if (!Number.isFinite(last) || last <= 0) throw new FeedError('UPSTREAM', 'Bad price from provider')
  return { last, ts: now }
}
// /quote payload -> { last, prevClose, open, high, low, ts, isOpen }
export function normaliseQuote(body, now = Math.floor(Date.now() / 1000)) {
  if (!body || body.status === 'error') throw toFeedError(body)
  const last = parseFloat(body.close)
  if (!Number.isFinite(last) || last <= 0) throw new FeedError('UPSTREAM', 'Bad quote from provider')
  const f = (x) => (Number.isFinite(parseFloat(x)) ? parseFloat(x) : null)
  const ts = Number.isFinite(Number(body.timestamp)) ? Number(body.timestamp) : now
  return { last, prevClose: f(body.previous_close), open: f(body.open), high: f(body.high), low: f(body.low), ts, isOpen: typeof body.is_market_open === 'boolean' ? body.is_market_open : null }
}

async function call(path, params, { key, fetchImpl = fetch, timeoutMs = 8000 }) {
  if (!key) throw new FeedError('NO_KEY')
  const qs = new URLSearchParams({ ...params, apikey: key, timezone: 'UTC', format: 'JSON' })
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
  try {
    const res = await fetchImpl(`${BASE}${path}?${qs}`, { signal: ctl?.signal, headers: { accept: 'application/json' } })
    let body = null
    try { body = await res.json() } catch { /* non-JSON */ }
    if (!res.ok || body?.status === 'error') throw toFeedError(body, res.status)
    return body
  } catch (e) {
    if (e instanceof FeedError) throw e
    throw new FeedError('UPSTREAM', e?.name === 'AbortError' ? 'Data provider timed out' : 'Data provider unreachable')
  } finally { if (timer) clearTimeout(timer) }
}

export function createTwelveData(opts) {
  return {
    name: PROVIDER,
    async candles(symbol, tf, { limit = 500, to } = {}) {
      const ps = toProviderSymbol(symbol)
      const interval = TF_INTERVAL[tf]
      if (!ps || !interval) throw new FeedError('BAD_REQUEST')
      const params = { symbol: ps, interval, outputsize: String(Math.min(5000, Math.max(1, limit))), order: 'DESC' }
      if (to) params.end_date = new Date(to * 1000).toISOString().slice(0, 19).replace('T', ' ')
      // DESC = the newest N rows (normaliseCandles sorts them oldest-first)
      return normaliseCandles(await call('/time_series', params, opts))
    },
    async price(symbol) {
      const ps = toProviderSymbol(symbol)
      if (!ps) throw new FeedError('BAD_REQUEST')
      return normalisePrice(await call('/price', { symbol: ps }, opts))
    },
    async quote(symbol) {
      const ps = toProviderSymbol(symbol)
      if (!ps) throw new FeedError('BAD_REQUEST')
      return normaliseQuote(await call('/quote', { symbol: ps }, opts))
    },
  }
}
