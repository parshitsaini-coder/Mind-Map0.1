// Tradable instruments for the demo terminal.
// price units: pipSize/spread/etc. are in PRICE units (e.g. 0.0001 for EURUSD).
//   contractSize — units of the instrument per 1.00 lot
//   quote        — currency the price is quoted in (P&L is converted to the USD account)
//   vol          — typical % move per DAY, drives the simulated feed
export const INSTRUMENTS = {
  XAUUSD: { symbol: 'XAUUSD', name: 'Gold / US Dollar', type: 'metal', quote: 'USD', digits: 2, pipSize: 0.1, contractSize: 100, minLot: 0.01, maxLot: 50, lotStep: 0.01, spread: 0.3, base: 4350, vol: 0.9 },
  EURUSD: { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'forex', quote: 'USD', digits: 5, pipSize: 0.0001, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.00012, base: 1.16, vol: 0.45 },
  GBPUSD: { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'forex', quote: 'USD', digits: 5, pipSize: 0.0001, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.00015, base: 1.33, vol: 0.55 },
  USDJPY: { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'forex', quote: 'JPY', digits: 3, pipSize: 0.01, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.012, base: 150, vol: 0.5 },
  GBPJPY: { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', type: 'forex', quote: 'JPY', digits: 3, pipSize: 0.01, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.025, base: 200, vol: 0.7 },
  NIFTY50: { symbol: 'NIFTY50', name: 'Nifty 50 (index)', type: 'index', quote: 'INR', digits: 2, pipSize: 1, contractSize: 50, minLot: 0.1, maxLot: 100, lotStep: 0.1, spread: 1, base: 22500, vol: 0.9 },
}

export const SYMBOLS = Object.keys(INSTRUMENTS)

// Fixed conversion rates used for quote->USD (demo only).
export const DEFAULT_RATES = { USDJPY: 150, USDINR: 83 }

export const TIMEFRAMES = [
  { id: 'M1', label: '1m', minutes: 1 },
  { id: 'M5', label: '5m', minutes: 5 },
  { id: 'M15', label: '15m', minutes: 15 },
  { id: 'M30', label: '30m', minutes: 30 },
  { id: 'H1', label: '1h', minutes: 60 },
  { id: 'H4', label: '4h', minutes: 240 },
  { id: 'D1', label: '1D', minutes: 1440 },
]
