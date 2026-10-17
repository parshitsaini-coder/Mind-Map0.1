// Shared logic for the /api/* serverless functions (Vercel Node runtime). Plain (req, res) handlers
// with injectable deps so the whole thing is unit-testable without a network or a key.
// SECURITY: the provider key is read from process.env only; it is never logged or returned.
import { FeedError, FEED_ERRORS, ALLOWED_SYMBOLS, TF_INTERVAL } from '../../src/lib/terminal/feed/feedTypes.js'
import { createTwelveData, PROVIDER } from '../../src/lib/terminal/feed/adapters/twelveData.js'

export const DAILY_BUDGET = 700 // stay under the free plan's 800 credits/day
export const MINUTE_BUDGET = 7 // ... and its 8 credits/minute
const RATE_PER_MIN = 60 // per IP

export const TTL = { M1: 20, M5: 30, M15: 45, M30: 60, H1: 90, D1: 180, W1: 600 } // seconds, forming candle
export const QUOTE_TTL = 25
export const HISTORY_TTL = 86400

export function createLimiter({ perMin = RATE_PER_MIN, now = () => Date.now() } = {}) {
  const hits = new Map()
  return (ip) => {
    const t = now()
    const arr = (hits.get(ip) || []).filter((x) => t - x < 60000)
    if (arr.length >= perMin) { hits.set(ip, arr); return Math.ceil((60000 - (t - arr[0])) / 1000) }
    arr.push(t)
    hits.set(ip, arr)
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > 60000) hits.delete(k)
    return 0
  }
}

export function createCore({ env = process.env, fetchImpl, now = () => Date.now(), limiter } = {}) {
  const lim = limiter || createLimiter({ now })
  const cache = new Map() // key -> { value, at, ttl }
  const inflight = new Map()
  let day = ''
  let used = 0
  const minuteCalls = []

  const budgetLeft = () => {
    const d = new Date(now()).toISOString().slice(0, 10)
    if (d !== day) { day = d; used = 0 }
    const t = now()
    while (minuteCalls.length && t - minuteCalls[0] > 60000) minuteCalls.shift()
    return used < DAILY_BUDGET && minuteCalls.length < MINUTE_BUDGET
  }
  const spend = () => { used++; minuteCalls.push(now()) }

  const provider = () => createTwelveData({ key: env.TWELVEDATA_API_KEY, fetchImpl })
  const providerName = () => ((env.FEED_PROVIDER || 'twelvedata').toLowerCase() === 'twelvedata' ? PROVIDER : null)

  // cached upstream call: fresh hit -> value; miss -> single-flight fetch; budget/errors -> stale value if any
  async function cached(key, ttlSec, fn) {
    const hit = cache.get(key)
    const t = now()
    if (hit && t - hit.at < ttlSec * 1000) return { value: hit.value, cached: true, stale: false }
    if (inflight.has(key)) return inflight.get(key)
    const p = (async () => {
      try {
        if (!budgetLeft()) throw new FeedError('QUOTA', 'Data provider quota reached — try again later')
        spend()
        const value = await fn()
        cache.set(key, { value, at: now(), ttl: ttlSec })
        if (cache.size > 300) cache.delete(cache.keys().next().value)
        return { value, cached: false, stale: false }
      } catch (e) {
        if (hit) return { value: hit.value, cached: true, stale: true, error: e }
        throw e
      } finally { inflight.delete(key) }
    })()
    inflight.set(key, p)
    return p
  }

  const send = (res, status, body, headers = {}) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
    res.end(JSON.stringify(body))
  }
  const fail = (res, e, headers = {}) => {
    const fe = e instanceof FeedError ? e : new FeedError('UPSTREAM')
    send(res, fe.status || 500, { error: { code: fe.code, message: fe.message } }, { 'Cache-Control': 'no-store', ...headers })
  }

  function allowedOrigin(req) {
    const origin = req.headers.origin
    if (!origin) return { ok: true, origin: null }
    const list = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
    let host = ''
    try { host = new URL(origin).host } catch { return { ok: false } }
    if (list.length ? list.includes(origin.replace(/\/$/, '')) : host === req.headers.host) return { ok: true, origin }
    return { ok: false }
  }
  const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim()

  // common gate: method, origin/CORS, rate limit, query parse
  function gate(req, res) {
    const o = allowedOrigin(req)
    if (!o.ok) { send(res, 403, { error: { code: 'FORBIDDEN', message: 'Origin not allowed' } }, { 'Cache-Control': 'no-store' }); return null }
    if (o.origin) { res.setHeader('Access-Control-Allow-Origin', o.origin); res.setHeader('Vary', 'Origin') }
    if (req.method === 'OPTIONS') {
      send(res, 204, {}, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
      return null
    }
    if (req.method !== 'GET') { send(res, 405, { error: { code: 'BAD_REQUEST', message: 'GET only' } }, { Allow: 'GET, OPTIONS' }); return null }
    const wait = lim(ipOf(req))
    if (wait) { fail(res, new FeedError('RATE_LIMIT'), { 'Retry-After': String(wait) }); return null }
    return new URL(req.url, 'http://local').searchParams
  }
  const symbolOf = (q) => {
    const s = String(q.get('symbol') || 'XAUUSD').toUpperCase()
    if (!ALLOWED_SYMBOLS.includes(s)) throw new FeedError('SYMBOL_NOT_ALLOWED')
    return s
  }

  return {
    _state: () => ({ used, cacheSize: cache.size }),
    async candles(req, res) {
      const q = gate(req, res)
      if (!q) return
      try {
        const symbol = symbolOf(q)
        const tf = String(q.get('tf') || 'M1').toUpperCase()
        if (!TF_INTERVAL[tf]) throw new FeedError('BAD_REQUEST', 'Unknown timeframe')
        const nowSec = Math.floor(now() / 1000)
        let limit = parseInt(q.get('limit') || '500', 10)
        if (!Number.isFinite(limit)) throw new FeedError('BAD_REQUEST', 'Bad limit')
        limit = Math.min(5000, Math.max(1, limit))
        let to = q.get('to') == null ? null : parseInt(q.get('to'), 10)
        if (to != null && !Number.isFinite(to)) throw new FeedError('BAD_REQUEST', 'Bad "to"')
        if (to != null) to = Math.min(nowSec, Math.max(0, to))
        if (!providerName()) throw new FeedError('UPSTREAM', 'Unknown FEED_PROVIDER')
        // history older than ~2 candle-lengths ago never changes -> cache it long
        const past = to != null && nowSec - to > 2 * (tf === 'W1' ? 604800 : tf === 'D1' ? 86400 : 3600)
        const ttl = past ? HISTORY_TTL : TTL[tf]
        const key = `c|${symbol}|${tf}|${limit}|${past ? to : 'live'}`
        const r = await cached(key, ttl, () => provider().candles(symbol, tf, { limit, to: past ? to : null }))
        send(res, 200, { symbol, tf, provider: PROVIDER, candles: r.value, serverTime: nowSec, stale: r.stale || undefined }, {
          'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${Math.max(5, Math.round(ttl / 2))}`,
        })
      } catch (e) { fail(res, e) }
    },
    async quote(req, res) {
      const q = gate(req, res)
      if (!q) return
      try {
        const symbol = symbolOf(q)
        if (!providerName()) throw new FeedError('UPSTREAM', 'Unknown FEED_PROVIDER')
        const r = await cached(`q|${symbol}`, QUOTE_TTL, () => provider().quote(symbol))
        send(res, 200, { symbol, provider: PROVIDER, ...r.value, serverTime: Math.floor(now() / 1000), stale: r.stale || undefined }, {
          'Cache-Control': `public, s-maxage=${QUOTE_TTL}, stale-while-revalidate=10`,
        })
      } catch (e) { fail(res, e) }
    },
    async symbols(req, res) {
      const q = gate(req, res)
      if (!q) return
      const term = String(q.get('q') || '').toUpperCase().slice(0, 30)
      const all = [{ symbol: 'XAUUSD', name: 'Gold / US Dollar' }]
      send(res, 200, { symbols: all.filter((s) => !term || s.symbol.includes(term) || s.name.toUpperCase().includes(term)) }, { 'Cache-Control': 'public, s-maxage=3600' })
    },
    async health(req, res) {
      const q = gate(req, res)
      if (!q) return
      budgetLeft()
      send(res, 200, { ok: !!env.TWELVEDATA_API_KEY, provider: providerName(), keyConfigured: !!env.TWELVEDATA_API_KEY, serverTime: Math.floor(now() / 1000), budget: { used, limit: DAILY_BUDGET }, errors: Object.keys(FEED_ERRORS) }, { 'Cache-Control': 'no-store' })
    },
  }
}
