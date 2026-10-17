// Tradable instruments for the demo terminal.
// price units: pipSize/spread/etc. are in PRICE units (e.g. 0.0001 for EURUSD).
//   contractSize — units of the instrument per 1.00 lot
//   quote        — currency the price is quoted in (P&L is converted to the USD account)
//   spread       — the SIMULATED spread added on top of the live mid price (Settings > Trading)
//   vol/base     — only used for sanity checks (typical % move per day / rough price level)
export const INSTRUMENTS = {
  XAUUSD: { symbol: 'XAUUSD', name: 'Gold / US Dollar', type: 'metal', quote: 'USD', digits: 2, pipSize: 0.1, contractSize: 100, minLot: 0.01, maxLot: 50, lotStep: 0.01, spread: 0.3, base: 4350, vol: 0.9, providerSymbol: 'XAU/USD' },
}

export const SYMBOLS = Object.keys(INSTRUMENTS)

// Symbols that existed before Phase 14 (simulated feed). They are NOT tradable any more; their old
// trades / positions can still exist in a saved account until the migration dialog is answered, so
// the UI and ledger must not crash on them.
export const LEGACY_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'NIFTY50']
const LEGACY_LOOK = {
  EURUSD: { digits: 5, pipSize: 0.0001, contractSize: 100000, quote: 'USD' }, GBPUSD: { digits: 5, pipSize: 0.0001, contractSize: 100000, quote: 'USD' },
  USDJPY: { digits: 3, pipSize: 0.01, contractSize: 100000, quote: 'JPY' }, GBPJPY: { digits: 3, pipSize: 0.01, contractSize: 100000, quote: 'JPY' },
  NIFTY50: { digits: 2, pipSize: 1, contractSize: 50, quote: 'INR' },
}
export const KNOWN_SYMBOLS = [...SYMBOLS, ...LEGACY_SYMBOLS]
export const instOf = (symbol) => INSTRUMENTS[symbol] || (LEGACY_LOOK[symbol] ? { symbol, name: symbol, type: 'legacy', minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0, ...LEGACY_LOOK[symbol] } : { symbol, name: symbol, type: 'legacy', digits: 2, pipSize: 0.01, contractSize: 1, quote: 'USD', minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0 })

// OFFLINE FALLBACK only: fixed quote->USD rates. XAUUSD is USD-quoted so these are unused today;
// kept so a future non-USD symbol degrades to an "approx" P/L instead of NaN.
export const DEFAULT_RATES = { USDJPY: 150, USDINR: 83 }

export const TIMEFRAMES = [
  { id: 'M1', label: '1m', minutes: 1 },
  { id: 'M5', label: '5m', minutes: 5 },
  { id: 'M15', label: '15m', minutes: 15 },
  { id: 'M30', label: '30m', minutes: 30 },
  { id: 'H1', label: '1h', minutes: 60 },
  { id: 'H4', label: '4h', minutes: 240 },
  { id: 'D1', label: '1D', minutes: 1440 },
  { id: 'W1', label: '1W', minutes: 10080 },
]
