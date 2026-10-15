// Simulated spread laid over a REAL mid price (Phase 14). Twelve Data / Finnhub give a last price only, so bid / ask are
// mid ± half a spread from the instrument table. Mode 'fixed' = base spread; 'variable' = it breathes with the clock
// (deterministic per symbol + 10 s bucket, so catch-up replays see the same spread). Labelled "simulated spread" in the UI.
import { INSTRUMENTS } from '../instruments.js'
import { applySpread } from '../engine.js'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

let spreadMode = 'fixed'
export const setSpreadMode = (m) => { spreadMode = m === 'variable' ? 'variable' : 'fixed' }
export const getSpreadMode = () => spreadMode

export function spreadFactor(symbol, time) {
  const r = mulberry32((hash(symbol) ^ Math.imul(Math.floor(time / 10), 0x9e3779b1)) >>> 0)()
  if (r < 0.8) return 1 + r * 0.25
  if (r < 0.97) return 1.5 + (r - 0.8) * 5
  return 3 + (r - 0.97) * 100
}

// mid (+ optional real bid / ask) -> the quote object the engine uses. Real bid / ask win over the simulated spread.
export function quoteFromMid(symbol, mid, time = Date.now() / 1000, real = null) {
  const inst = INSTRUMENTS[symbol]
  if (real && Number.isFinite(real.bid) && Number.isFinite(real.ask) && real.ask >= real.bid) {
    return { symbol, time, mid, bid: real.bid, ask: real.ask, spread: real.ask - real.bid, real: true }
  }
  const spread = spreadMode === 'variable' ? inst.spread * spreadFactor(symbol, time) : inst.spread
  const { bid, ask } = applySpread(mid, spread, inst.digits)
  return { symbol, time, mid, bid, ask, spread }
}
