// Browser side of the data layer (Phase 14): talks ONLY to same-origin /api/*, never to a vendor. fetch / base URL are
// injected so it is testable. Errors are typed like the server's (feedTypes.js FeedError).
import { TF_IDS } from './symbolMap.js'

export class FeedClientError extends Error {
  constructor(code, message, { status = 0, retryAfter = 0 } = {}) { super(message); this.code = code; this.status = status; this.retryAfter = retryAfter }
}

export function createLiveClient({ fetchImpl = globalThis.fetch?.bind(globalThis), base = '/api', timeoutMs = 15000 } = {}) {
  async function call(path, params) {
    if (!fetchImpl) throw new FeedClientError('network', 'No network available')
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString()
    let r
    try {
      r = await fetchImpl(`${base}/${path}?${qs}`, { headers: { accept: 'application/json' }, signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined })
    } catch (e) { throw new FeedClientError('network', 'Could not reach the price server') }
    let body = null
    try { body = await r.json() } catch { /* not JSON */ }
    if (!r.ok) {
      const e = body?.error || {}
      throw new FeedClientError(e.code || 'upstream', e.message || `Price server answered ${r.status}`, { status: r.status, retryAfter: Number(e.retryAfter) || 0 })
    }
    if (!body) throw new FeedClientError('upstream', 'Price server sent an unreadable answer', { status: r.status })
    return body
  }
  return {
    // -> Candle[] ascending, de-duplicated
    async getCandles(symbol, tf, { limit = 500, to } = {}) {
      if (!TF_IDS.includes(tf)) throw new FeedClientError('bad_request', 'Unknown timeframe')
      const b = await call('candles', { symbol, tf, limit, to })
      const seen = new Map()
      for (const c of b.candles || []) if (c && Number.isFinite(c.time) && Number.isFinite(c.close)) seen.set(c.time, c)
      return { candles: [...seen.values()].sort((a, c) => a.time - c.time), serverTime: b.serverTime, source: b.source }
    },
    // -> { quotes: { SYM: Tick | {error} }, serverTime }
    async getQuotes(symbols) { const b = await call('quote', { symbols: symbols.join(',') }); return { quotes: b.quotes || {}, serverTime: b.serverTime } },
    async searchSymbols(q) { const b = await call('symbols', { q }); return b.symbols || b }
    ,async health() { return call('health', {}) },
  }
}
