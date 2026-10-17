// TEST-ONLY: the pre-Phase-14 multi-symbol instrument table, so the old ledger/engine/stats tests
// (which use EURUSD etc. as neutral fixtures) keep running. The app itself is XAUUSD-only.
import { INSTRUMENTS, SYMBOLS } from '../../src/lib/terminal/instruments.js'

const LEGACY = {
  EURUSD: { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'forex', quote: 'USD', digits: 5, pipSize: 0.0001, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.00012, base: 1.16, vol: 0.45 },
  GBPUSD: { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'forex', quote: 'USD', digits: 5, pipSize: 0.0001, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.00015, base: 1.33, vol: 0.55 },
  USDJPY: { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'forex', quote: 'JPY', digits: 3, pipSize: 0.01, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.012, base: 150, vol: 0.5 },
  GBPJPY: { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', type: 'forex', quote: 'JPY', digits: 3, pipSize: 0.01, contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, spread: 0.025, base: 200, vol: 0.7 },
  NIFTY50: { symbol: 'NIFTY50', name: 'Nifty 50 (index)', type: 'index', quote: 'INR', digits: 2, pipSize: 1, contractSize: 50, minLot: 0.1, maxLot: 100, lotStep: 0.1, spread: 1, base: 22500, vol: 0.9 },
}
for (const [k, v] of Object.entries(LEGACY)) {
  if (!INSTRUMENTS[k]) { INSTRUMENTS[k] = v; SYMBOLS.push(k) }
}
export const LEGACY_SYMBOLS = Object.keys(LEGACY)
