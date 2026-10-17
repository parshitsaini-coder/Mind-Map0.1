// "Simulated spread over live mid" (Settings > Trading). The data provider only gives a mid/last
// price, so bid/ask = live mid -/+ half of a clearly labelled SIMULATED spread.
//   fixed    = the instrument's base spread
//   variable = breathes with the clock: mostly 1-1.2x, sometimes ~2x, rarely 3-6x (news-like).
// Deterministic in (symbol, 10-second bucket) so a replay sees the same spread the live feed did.
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
export function quoteFromMid(symbol, mid, time = Date.now() / 1000) {
  const inst = INSTRUMENTS[symbol]
  const spread = spreadMode === 'variable' ? inst.spread * spreadFactor(symbol, time) : inst.spread
  const { bid, ask } = applySpread(mid, spread, inst.digits)
  return { symbol, time, mid, bid, ask, spread }
}
