// Feed contract (Phase 14). Everything is async; the browser only ever talks to same-origin /api/*.
//
// Candle      { time:number /* UTC seconds, bucket start */, open, high, low, close, volume:number }
// Tick        { bid, ask, last, ts:number /* UTC seconds */, source:string }
// FeedStatus  { state:'live'|'delayed'|'offline'|'closed'|'loading', provider:string, lastUpdate:number|null, reason:string|null }
//
// interface Feed {
//   getCandles(symbol, tf, { from?, to?, limit? }): Promise<Candle[]>   oldest first
//   subscribe(symbol, cb: (tick: Tick) => void): () => void              returns unsubscribe
//   getQuoteSnapshot(symbol): Promise<Tick>
//   getStatus(): FeedStatus
//   searchSymbols(q): Promise<{ symbol, name }[]>
// }
//
// Typed errors (same codes on the server and in the browser).
export const FEED_ERRORS = {
  BAD_REQUEST: { status: 400, message: 'Invalid request' },
  SYMBOL_NOT_ALLOWED: { status: 400, message: 'Only XAUUSD is available' },
  NO_KEY: { status: 503, message: 'Data provider key is not configured on the server' },
  QUOTA: { status: 429, message: 'Data provider quota reached — try again later' },
  RATE_LIMIT: { status: 429, message: 'Too many requests — slow down' },
  UPSTREAM: { status: 502, message: 'Data provider error' },
  OFFLINE: { status: 0, message: 'No connection' },
}
export class FeedError extends Error {
  constructor(code, detail) {
    super(detail || FEED_ERRORS[code]?.message || code)
    this.code = code
    this.status = FEED_ERRORS[code]?.status ?? 500
  }
}
export const ALLOWED_SYMBOLS = ['XAUUSD']
export const FEED_ALLOWED = ALLOWED_SYMBOLS
// Provider interval names. H4 is built from H1 (see candleStore.aggregate).
export const TF_INTERVAL = { M1: '1min', M5: '5min', M15: '15min', M30: '30min', H1: '1h', D1: '1day', W1: '1week' }
export const TF_SECONDS = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800 }
export const FEED_TFS = Object.keys(TF_SECONDS)
