// Web Worker: runs indicator maths off the UI thread.
// in:  { rid, configs:[{id,type,params}], candles, ctx }
// out: { rid, results:{ [id]: {lineKey: (number|null)[]} | null } }
import { computeIndicator } from './indicators.js'

self.onmessage = (e) => {
  const { rid, configs, candles, ctx } = e.data
  const results = {}
  for (const c of configs) {
    try { results[c.id] = computeIndicator(c, candles, ctx) } catch { results[c.id] = null }
  }
  self.postMessage({ rid, results })
}
