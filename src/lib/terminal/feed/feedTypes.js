// The data-layer contract (Phase 14). JSDoc only: nothing here runs. Every provider adapter and the browser feed follow it,
// so the chart, the quote hub and the engine never know which vendor is behind the prices.
//
// @typedef {'M1'|'M5'|'M15'|'M30'|'H1'|'H4'|'D1'|'W1'} TfId
//
// @typedef {Object} Candle            one bar, UTC seconds at the START of the bar
// @property {number} time
// @property {number} open @property {number} high @property {number} low @property {number} close
// @property {number} volume           0 when the provider has none (forex / metals)
//
// @typedef {Object} Tick              what subscribe() delivers
// @property {number|null} bid         null when the provider only has a last price
// @property {number|null} ask
// @property {number} last             last / mid price
// @property {number} ts               provider timestamp, ms since epoch (UTC)
// @property {string} source           'twelvedata' | 'finnhub' | ...
// @property {boolean} [marketOpen]    provider's own opinion, when it gives one
// @property {number} [dayOpen] @property {number} [prevClose]
//
// @typedef {'live'|'delayed'|'offline'|'closed'|'connecting'} FeedState
// @typedef {{state: FeedState, source: string|null, lastTickMs: number|null, reason?: string}} FeedStatus
//
// @typedef {Object} FeedError
// @property {'bad_request'|'unsupported_symbol'|'rate_limited'|'quota'|'plan'|'auth'|'upstream'|'not_configured'} code
// @property {number} status           the HTTP status we answer with
// @property {string} message          safe to show to the person
// @property {number} [retryAfter]     seconds
//
// Browser side (all async):
//   getCandles(symbol, tf, {from?, to?, limit?}) -> Promise<Candle[]>      ascending by time, de-duplicated
//   subscribe(symbol, cb: (tick: Tick) => void)  -> unsubscribe function   ref-counted by the quote hub
//   getQuoteSnapshot(symbols)                    -> Promise<Record<string, Tick>>
//   getStatus()                                  -> FeedStatus
//   searchSymbols(q)                             -> Promise<{symbol, name, type}[]>
//
// Server side: GET /api/candles /api/quote /api/symbols /api/health. The browser never talks to a vendor.
export {}
