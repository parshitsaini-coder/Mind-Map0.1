// Stateful wrapper around the indicator maths. The Web Worker runs this off the main thread;
// where Workers are unavailable (tests, very old browsers) the same code runs in-thread.
//
//   init({ candles, cfgs, ctx })      -> { full: true,  n, results }          (everything)
//   tick({ candle, isNew })           -> { full: false, n, tail }             (last value per line)
//                                     -> { full: true,  n, results }          (when a new bar opened)
//   results = [{ id, lines: {key: (number|null)[]}, shifts?, meta? }]
//   tail    = [{ id, v: {key: number|null} }]
import { computeIndicator } from './indicators.js'

export const CANDLE_CAP = 6000 // most bars kept for indicator maths
export const CANDLE_TRIM = 500 // dropped from the front when the cap is passed

export function createCore() {
  let candles = []
  let cfgs = []
  let ctx = {}
  const compute = () => cfgs.map((c) => ({ id: c.id, ...computeIndicator(c.type, candles, c.params, ctx) }))
  return {
    init(m) {
      candles = (m.candles || []).slice()
      cfgs = m.cfgs || []
      ctx = m.ctx || {}
      return { full: true, n: candles.length, results: compute() }
    },
    tick({ candle, isNew }) {
      if (isNew || !candles.length) {
        candles.push(candle)
        if (candles.length > CANDLE_CAP) candles = candles.slice(CANDLE_TRIM)
      } else {
        candles[candles.length - 1] = candle
      }
      const results = compute()
      if (isNew) return { full: true, n: candles.length, results }
      return {
        full: false,
        n: candles.length,
        tail: results.map((r) => ({ id: r.id, v: Object.fromEntries(Object.entries(r.lines).map(([k, a]) => [k, a[a.length - 1] ?? null])) })),
      }
    },
  }
}
