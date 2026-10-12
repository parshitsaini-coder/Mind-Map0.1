// Web Worker entry: all indicator maths runs here so the chart never janks while ticking.
import { createCore } from './indicatorCore.js'

const core = createCore()
self.onmessage = (e) => {
  const m = e.data
  try {
    const out = m.type === 'init' ? core.init(m) : core.tick(m)
    self.postMessage({ gen: m.gen, ...out })
  } catch (err) {
    self.postMessage({ gen: m.gen, error: String(err && err.message ? err.message : err) })
  }
}
