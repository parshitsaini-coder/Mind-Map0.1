// Talks to the indicator Web Worker (or computes in-thread when Workers are unavailable).
// Each init() starts a new "generation"; replies from an older generation are dropped, so a
// slow calculation for the previous symbol / timeframe can never paint onto the new chart.
import { createCore } from './indicatorCore.js'

export function createIndicatorEngine(onResult) {
  let gen = 0
  let worker = null
  let core = null
  let disposed = false
  try {
    if (typeof Worker !== 'undefined') worker = new Worker(new URL('./indicators.worker.js', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }
  if (worker) {
    worker.onmessage = (e) => { if (!disposed && e.data.gen === gen) onResult(e.data) }
    worker.onerror = () => { /* the next init() will retry; chart keeps working without indicators */ }
  } else {
    core = createCore()
  }
  const send = (msg) => {
    if (disposed) return
    if (worker) { worker.postMessage(msg); return }
    const g = msg.gen
    queueMicrotask(() => {
      if (disposed || g !== gen) return
      try { onResult({ gen: g, ...(msg.type === 'init' ? core.init(msg) : core.tick(msg)) }) } catch (err) { onResult({ gen: g, error: String(err) }) }
    })
  }
  return {
    get usesWorker() { return !!worker },
    init(candles, cfgs, ctx) { gen++; send({ type: 'init', gen, candles, cfgs, ctx }) },
    tick(candle, isNew) { send({ type: 'tick', gen, candle, isNew }) },
    dispose() { disposed = true; if (worker) worker.terminate() },
  }
}
