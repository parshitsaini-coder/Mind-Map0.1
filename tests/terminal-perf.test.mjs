// Phase 8 performance audit (what can be measured without a browser): per-tick engine cost, memory
// growth over a long simulated session, indicator maths on the largest history the app keeps, and the
// cost of building / parsing a full cloud row. Run with `node --expose-gc` for the leak check.
import * as L from '../src/lib/terminal/ledger.js'
import * as C from '../src/lib/terminal/cloudSync.js'
import { INDICATOR_TYPES, computeIndicator, defaultParams } from '../src/lib/terminal/indicators.js'
import { quoteFromMid } from '../src/lib/terminal/feed/simulatedFeed.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const ms = (f) => { const t = performance.now(); const r = f(); return [performance.now() - t, r] }
const heapMB = () => { globalThis.gc?.(); return process.memoryUsage().heapUsed / 1048576 }

// ── 1. engine per tick: 15 open positions + 10 pending orders that never trigger ──
{
  const Q0 = { EURUSD: { bid: 1.0999, ask: 1.1001 }, GBPUSD: { bid: 1.2999, ask: 1.3001 } }
  let l = L.createLedger(1_000_000, 500, 1)
  for (let i = 0; i < 15; i++) l = L.openPosition(l, { symbol: i % 2 ? 'GBPUSD' : 'EURUSD', side: i % 3 ? 'buy' : 'sell', lots: 0.1, sl: i % 3 ? (i % 2 ? 1.2 : 1.0) : (i % 2 ? 1.4 : 1.2), tp: i % 3 ? (i % 2 ? 1.4 : 1.2) : (i % 2 ? 1.2 : 1.0) }, Q0, 5 + i).ledger
  for (let i = 0; i < 10; i++) { const r = L.placeOrder(l, { symbol: 'EURUSD', type: 'limit', side: i % 2 ? 'buy' : 'sell', lots: 0.1, price: i % 2 ? 1.0 : 1.2 }, Q0, 100 + i); if (r.error) throw new Error(r.error); l = r.ledger }
  const N = 200_000
  const h0 = heapMB()
  const [t] = ms(() => {
    let mid = 1.1
    for (let i = 0; i < N; i++) {
      mid += Math.sin(i / 50) * 0.00002
      const q = { EURUSD: quoteFromMid('EURUSD', mid, 1000 + i / 10), GBPUSD: quoteFromMid('GBPUSD', mid + 0.2, 1000 + i / 10) }
      L.processTick(l, q, { now: 1000 + Math.floor(i / 10) })
    }
  })
  const h1 = heapMB()
  const per = (t / N) * 1000
  console.log(`  ${N.toLocaleString()} ticks (25 live objects): ${t.toFixed(0)} ms → ${per.toFixed(1)} µs / tick; heap ${h0.toFixed(1)} → ${h1.toFixed(1)} MB`)
  check('a tick costs well under 1 ms (UI is throttled to ~10/s, so ~100× headroom)', per < 1000, `${per} µs`)
  if (globalThis.gc) check('no memory growth over 200k ticks (< 25 MB after GC)', h1 - h0 < 25, `${(h1 - h0).toFixed(1)} MB`)
  else console.log('  (run with --expose-gc to check memory growth)')
}

// ── 2. indicators on the biggest history the chart keeps (CANDLE_CAP = 6000 bars) ──
{
  let p = 1.1
  const candles = Array.from({ length: 6000 }, (_, i) => {
    const o = p; p += (Math.sin(i / 37) + Math.cos(i / 11)) * 0.0004
    return { time: 1_700_000_000 + i * 900, open: o, high: Math.max(o, p) + 0.0002, low: Math.min(o, p) - 0.0002, close: p, volume: 100 + (i % 50) }
  })
  let worst = 0, worstName = ''
  let total = 0
  for (const type of INDICATOR_TYPES) {
    const [t] = ms(() => computeIndicator(type, candles, defaultParams(type), { tz: 0 }))
    total += t
    if (t > worst) { worst = t; worstName = type }
  }
  console.log(`  ${INDICATOR_TYPES.length} indicator types on 6,000 bars: ${total.toFixed(0)} ms total, slowest ${worstName} ${worst.toFixed(0)} ms`)
  check('every indicator on 6,000 bars finishes in < 150 ms (the Worker keeps it off the UI thread anyway)', worst < 150, `${worstName} ${worst}`)
  check('all of them together < 1 s', total < 1000, String(total))
}

// ── 3. cloud row for a full account (2,000 trades) ──
{
  let l = L.createLedger(10000, 100, 1)
  const q = { EURUSD: { bid: 1.0999, ask: 1.1001 } }
  for (let i = 0; i < 2000; i++) {
    const o = L.openPosition(l, { symbol: 'EURUSD', side: i % 2 ? 'sell' : 'buy', lots: 0.01 }, q, 1000 + i)
    l = L.closePosition(o.ledger, o.position.id, { EURUSD: { bid: 1.1004, ask: 1.1006 } }, { now: 2000 + i }).ledger
  }
  const st = { ...l, journaled: {}, drawings: {}, indicators: [], layout: 1, charts: C.DEFAULT_CHARTS, activeChart: 0, chartType: 'candles', settings: {} }
  const [tb, built] = ms(() => C.buildRow(st))
  const json = JSON.stringify(built.row)
  const [tp] = ms(() => C.parseRow(JSON.parse(json)))
  console.log(`  2,000-trade row: build ${tb.toFixed(0)} ms, parse ${tp.toFixed(0)} ms, ${(json.length / 1024).toFixed(0)} KB (plain would be ${(JSON.stringify(l.history).length / 1024).toFixed(0)} KB)`)
  check('build + parse of a full account < 250 ms each', tb < 250 && tp < 250)
  check('a full 2,000-trade account uploads in well under 1 MB', json.length < 1_000_000, String(json.length))
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
