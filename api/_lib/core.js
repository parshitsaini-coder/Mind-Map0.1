// The proxy logic (Phase 14). api/*.js are thin wrappers; everything testable lives here with env, fetch and the clock injected.
// Secrets come ONLY from env (no VITE_ prefix) and are never logged or returned. The browser talks to /api/* and never to a vendor.
import { routeOf, TF_SECONDS, ALLOWED_SYMBOLS, SYMBOL_MAP } from '../../src/lib/terminal/feed/symbolMap.js'
import { parseCandlesQuery, parseQuoteQuery, createRateLimiter, createCreditBudget, cachePolicy, corsHeaders, clientIp } from '../../src/lib/terminal/feed/serverGuard.js'
import { feedError, httpOf, isFeedError } from '../../src/lib/terminal/feed/adapters/errors.js'
import * as TD from '../../src/lib/terminal/feed/adapters/twelveData.js'
import * as FH from '../../src/lib/terminal/feed/adapters/finnhub.js'
import { aggregate } from '../../src/lib/terminal/feed/candleMath.js'
import { INSTRUMENTS } from '../../src/lib/terminal/instruments.js'

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d }

export function createProxy({ env = {}, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const limiter = createRateLimiter({ limit: num(env.RATE_LIMIT_PER_MIN, 120) })
  const budgets = {
    twelvedata: createCreditBudget({ perMinute: num(env.TWELVEDATA_CREDITS_PER_MIN, 8), perDay: num(env.TWELVEDATA_CREDITS_PER_DAY, 800) }),
    finnhub: createCreditBudget({ perMinute: num(env.FINNHUB_CALLS_PER_MIN, 50) }),
  }
  const keys = { twelvedata: env.TWELVEDATA_API_KEY, finnhub: env.FINNHUB_API_KEY }

  function key(provider) {
    if (!keys[provider]) throw feedError('not_configured', 'Price provider is not configured on the server')
    return keys[provider]
  }
  function spend(provider, n) {
    const r = budgets[provider].spend(n, now())
    if (!r.ok) throw feedError(r.code, r.code === 'quota' ? 'Daily data limit reached' : 'Price provider is busy, retrying', { retryAfter: r.retryAfter })
  }
  async function fetchJson(url, headers) {
    let r
    try { r = await fetchImpl(url, { headers, signal: AbortSignal.timeout(8000) }) } catch { throw feedError('upstream', 'Price provider did not answer') }
    let json = null
    try { json = await r.json() } catch { /* not JSON */ }
    return { json, status: r.status }
  }

  const routes = {
    async candles(query) {
      const nowSec = Math.floor(now() / 1000)
      const q = parseCandlesQuery(query, nowSec)
      const route = routeOf(q.symbol, env)
      const tfSec = TF_SECONDS[q.tf]
      let candles
      if (route.provider === 'twelvedata') {
        spend('twelvedata', 1)
        const { json, status } = await fetchJson(TD.candlesUrl(route.vendor, q.tf, q), TD.authHeaders(key('twelvedata')))
        candles = TD.normalizeCandles(json, status)
      } else {
        const agg = FH.needsAggregate(q.tf)
        const srcTf = agg ? 'H1' : q.tf
        const span = q.limit * tfSec
        const from = q.from ?? q.to - span
        spend('finnhub', 1)
        const { json, status } = await fetchJson(FH.candlesUrl(route.vendor, srcTf, { from, to: q.to }), FH.authHeaders(key('finnhub')))
        candles = FH.normalizeCandles(json, status)
        if (agg) candles = aggregate(candles, tfSec)
      }
      if (candles.length > q.limit) candles = candles.slice(candles.length - q.limit)
      return { body: { symbol: q.symbol, tf: q.tf, source: route.provider, serverTime: now(), candles }, cache: cachePolicy({ kind: 'candles', tfSec, toSec: q.to, nowSec }) }
    },

    async quote(query) {
      const symbols = parseQuoteQuery(query)
      const quotes = {}
      const td = symbols.filter((s) => routeOf(s, env).provider === 'twelvedata')
      const fh = symbols.filter((s) => routeOf(s, env).provider === 'finnhub')
      const jobs = []
      if (td.length) jobs.push((async () => {
        try {
          spend('twelvedata', td.length)
          const vendors = td.map((s) => routeOf(s, env).vendor)
          const { json, status } = await fetchJson(TD.quoteUrl(vendors), TD.authHeaders(key('twelvedata')))
          const r = TD.normalizeQuotes(json, vendors, status)
          td.forEach((s, i) => { quotes[s] = r[vendors[i]] })
        } catch (e) { td.forEach((s) => { quotes[s] = e }) }
      })())
      for (const s of fh) jobs.push((async () => {
        try {
          spend('finnhub', 1)
          const to = Math.floor(now() / 1000)
          const { json, status } = await fetchJson(FH.candlesUrl(routeOf(s, env).vendor, 'M1', { from: to - 900, to }), FH.authHeaders(key('finnhub')))
          const t = FH.tickFromCandles(FH.normalizeCandles(json, status))
          quotes[s] = t || feedError('upstream', 'No price available')
        } catch (e) { quotes[s] = e }
      })())
      await Promise.all(jobs)
      const out = {}
      let good = 0
      for (const s of symbols) {
        const v = quotes[s]
        if (isFeedError(v)) out[s] = { error: { code: v.code, message: v.message, ...(v.retryAfter ? { retryAfter: v.retryAfter } : {}) } }
        else { out[s] = v; good++ }
      }
      if (!good) throw quotes[symbols[0]] // every symbol failed: answer with the real error so the client backs off
      return { body: { serverTime: now(), quotes: out }, cache: cachePolicy({ kind: 'quote', quoteTtl: num(env.QUOTE_TTL_SECONDS, 5) }) }
    },

    async symbols(query) {
      const q = String(query.q || '').trim().toLowerCase().slice(0, 40)
      const list = ALLOWED_SYMBOLS.map((s) => ({ symbol: s, name: INSTRUMENTS[s]?.name || s, type: SYMBOL_MAP[s].kind }))
      return { body: { symbols: q ? list.filter((x) => x.symbol.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)) : list }, cache: cachePolicy({ kind: 'symbols' }) }
    },

    async health() {
      const t = now()
      return { body: { ok: true, serverTime: t, providers: { twelvedata: !!keys.twelvedata, finnhub: !!keys.finnhub }, usage: { twelvedata: budgets.twelvedata.usage(t), finnhub: budgets.finnhub.usage(t) } }, cache: 'no-store' }
    },
  }

  // Node-style (req, res). Works on Vercel and in tests with a fake res.
  async function handle(name, req, res) {
    const send = (status, body, headers = {}) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
      res.end(JSON.stringify(body))
    }
    try {
      const cors = corsHeaders(req.headers.origin, env.ALLOWED_ORIGIN)
      if (!cors.ok) return send(403, { error: { code: 'bad_request', message: 'Origin not allowed' } })
      if (req.method === 'OPTIONS') return send(204, {}, cors.headers)
      if (req.method !== 'GET') return send(405, { error: { code: 'bad_request', message: 'GET only' } }, { ...cors.headers, Allow: 'GET, OPTIONS' })
      const rl = limiter.take(clientIp(req.headers), now())
      if (!rl.ok) return send(429, { error: { code: 'rate_limited', message: 'Too many requests', retryAfter: rl.retryAfter } }, { ...cors.headers, 'Retry-After': String(rl.retryAfter), 'Cache-Control': 'no-store' })
      const r = await routes[name](req.query || {})
      return send(200, r.body, { ...cors.headers, 'Cache-Control': r.cache })
    } catch (e) {
      const h = httpOf(e)
      return send(h.status, h.body, { ...h.headers, 'Cache-Control': 'no-store' }) // errors are never cached at the edge
    }
  }
  return { handle, routes, budgets, limiter }
}
