// App symbol -> which provider serves it and under what name there (Phase 14). The static instrument specs (pip, digits,
// contract size) stay in instruments.js; only PRICES are live. NIFTY50 has no free live source: it is deliberately absent.
export const TF_SECONDS = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800 }
export const TF_IDS = Object.keys(TF_SECONDS)

export const SYMBOL_MAP = {
  XAUUSD: { provider: 'twelvedata', vendor: 'XAU/USD', kind: 'metal' },
  EURUSD: { provider: 'twelvedata', vendor: 'EUR/USD', kind: 'forex' },
  GBPUSD: { provider: 'twelvedata', vendor: 'GBP/USD', kind: 'forex' },
  USDJPY: { provider: 'twelvedata', vendor: 'USD/JPY', kind: 'forex' },
  GBPJPY: { provider: 'twelvedata', vendor: 'GBP/JPY', kind: 'forex' },
  BTCUSD: { provider: 'finnhub', vendor: 'BINANCE:BTCUSDT', kind: 'crypto' },
  ETHUSD: { provider: 'finnhub', vendor: 'BINANCE:ETHUSDT', kind: 'crypto' },
}
export const ALLOWED_SYMBOLS = Object.keys(SYMBOL_MAP)
export const isAllowed = (s) => typeof s === 'string' && Object.prototype.hasOwnProperty.call(SYMBOL_MAP, s)

// env: process.env. FEED_PROVIDER_<KIND>=twelvedata|finnhub overrides the default for an asset class (e.g. FEED_PROVIDER_CRYPTO=twelvedata).
export function routeOf(symbol, env = {}) {
  const m = isAllowed(symbol) ? SYMBOL_MAP[symbol] : null
  if (!m) return null
  const over = env[`FEED_PROVIDER_${m.kind.toUpperCase()}`]
  if (over && over !== m.provider) {
    const alt = { twelvedata: { forex: 1, metal: 1, crypto: 1 }, finnhub: { forex: 1, crypto: 1 } }[over]
    if (alt && alt[m.kind]) return { ...m, provider: over, vendor: toVendor(symbol, over) }
  }
  return m
}
// Vendor name for a symbol on a provider other than its default.
export function toVendor(symbol, provider) {
  if (provider === 'twelvedata') return symbol.slice(0, 3) + '/' + symbol.slice(3).replace('USDT', 'USD')
  if (provider === 'finnhub') return symbol.startsWith('BTC') || symbol.startsWith('ETH') ? `BINANCE:${symbol.slice(0, 3)}USDT` : `OANDA:${symbol.slice(0, 3)}_${symbol.slice(3)}`
  return symbol
}
