// Hand-checked examples for the indicator maths. Run: node tests/terminal-indicators.test.mjs
import * as I from '../src/lib/terminal/indicators.js'
import { createCore, CANDLE_CAP } from '../src/lib/terminal/indicatorCore.js'
import { getCandles } from '../src/lib/terminal/feed/simulatedFeed.js'

let fail = 0
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }
const near = (a, b, tol = 1e-6) => a != null && b != null && Math.abs(a - b) <= tol
const arrNear = (a, b, tol = 1e-6) => a.length === b.length && a.every((v, i) => (v == null ? b[i] == null : near(v, b[i], tol)))
const C = (o, h, l, c, time = 0, volume) => ({ time, open: o, high: h, low: l, close: c, volume })
const fromCloses = (cl) => cl.map((c, i) => C(c, c, c, c, i * 60))

// ── moving averages ──
check('SMA(3) of 1..5', arrNear(I.sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]))
check('SMA skips leading nulls', arrNear(I.sma([null, 1, 2, 3], 2), [null, null, 1.5, 2.5]))
check('EMA(3) of 1..5 (SMA seed)', arrNear(I.ema([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]))
check('EMA on a constant is that constant', I.ema(new Array(30).fill(7), 10).slice(9).every((v) => near(v, 7)))
check('WMA(3) of 1..4 = 14/6, 20/6', arrNear(I.wma([1, 2, 3, 4], 3), [null, null, 14 / 6, 20 / 6]))

// ── Bollinger ──
{
  const b = I.bollinger(fromCloses([1, 2, 3, 4, 5]), 5, 2).lines
  check('BB(5,2) of 1..5: mid 3, sd √2', near(b.mid[4], 3) && near(b.upper[4], 3 + 2 * Math.SQRT2) && near(b.lower[4], 3 - 2 * Math.SQRT2))
  check('BB has no value before the window fills', b.mid[3] == null && b.upper[3] == null)
}

// ── RSI: Wilder's published example (StockCharts) → first RSI(14) = 70.53 ──
{
  const cl = [44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931, 46.0328, 45.614, 46.282, 46.282, 46.0028, 46.0328, 46.4116, 46.2222, 45.6439]
  const r = I.rsi(fromCloses(cl), 14).lines.rsi
  check('RSI(14) first value ≈ 70.53', near(r[14], 70.53, 0.02), String(r[14]))
  check('RSI(14) second value ≈ 66.32', near(r[15], 66.32, 0.02), String(r[15]))
  check('RSI is null before period', r.slice(0, 14).every((v) => v == null))
  check('RSI of a rising series = 100', I.rsi(fromCloses([1, 2, 3, 4, 5, 6]), 3).lines.rsi[5] === 100)
  check('RSI of a falling series = 0', near(I.rsi(fromCloses([6, 5, 4, 3, 2, 1]), 3).lines.rsi[5], 0))
  check('RSI of a flat series = 50', I.rsi(fromCloses([5, 5, 5, 5, 5]), 3).lines.rsi[4] === 50)
}

// ── MACD ──
{
  const m = I.macd(fromCloses(new Array(60).fill(10)), 12, 26, 9).lines
  check('MACD of a flat series = 0', near(m.macd[59], 0) && near(m.signal[59], 0) && near(m.hist[59], 0))
  check('MACD line starts at slow period', m.macd[24] == null && m.macd[25] != null)
  check('MACD signal starts 8 bars later', m.signal[32] == null && m.signal[33] != null)
  const up = I.macd(fromCloses(Array.from({ length: 60 }, (_, i) => 10 + i)), 12, 26, 9).lines
  check('MACD in a steady rise is positive', up.macd[59] > 0)
}

// ── Stochastic ──
{
  const cs = [C(0, 10, 0, 5), C(0, 10, 0, 5), C(0, 10, 0, 5), C(0, 10, 0, 10)]
  const s = I.stochastic(cs, 3, 1, 1).lines
  check('Stoch raw %K = 50 then 100 at the high', near(s.k[2], 50) && near(s.k[3], 100))
  const flat = I.stochastic(fromCloses([5, 5, 5, 5]), 3, 1, 1).lines
  check('Stoch on zero range = 50 (no divide by zero)', near(flat.k[3], 50))
}

// ── ATR ──
{
  const cs = Array.from({ length: 20 }, (_, i) => C(100, 101, 99, 100, i))
  check('ATR(14) of constant 2-wide candles = 2', near(I.atr(cs, 14).lines.atr[19], 2) && I.atr(cs, 14).lines.atr[12] == null)
  const gap = [C(100, 101, 99, 100), C(110, 111, 109, 110)]
  check('True range includes the gap (|111−100| = 11)', near(I.trueRange(gap)[1], 11), String(I.trueRange(gap)[1]))
}

// ── VWAP ──
{
  const v = I.vwap([C(10, 10, 10, 10, 0, 100), C(20, 20, 20, 20, 60, 300)], 0).lines.vwap
  check('VWAP = (10·100 + 20·300)/400 = 17.5', near(v[1], 17.5))
  const next = I.vwap([C(10, 10, 10, 10, 0, 100), C(20, 20, 20, 20, 86400, 300)], 0).lines.vwap
  check('VWAP resets on a new day', near(next[1], 20))
  check('VWAP with no volume reports it', I.vwap(fromCloses([1, 2, 3])).meta?.noVolume === true)
}

// ── Supertrend ──
{
  const rising = Array.from({ length: 40 }, (_, i) => C(100 + i, 101 + i, 99 + i, 100.5 + i, i))
  const st = I.supertrend(rising, 10, 3).lines
  check('Supertrend in a steady rise is UP (line under price)', st.up[39] != null && st.down[39] == null && st.up[39] < rising[39].low)
  const drop = rising.concat(Array.from({ length: 30 }, (_, i) => C(140 - i * 3, 141 - i * 3, 139 - i * 3 - 2, 139.5 - i * 3 - 2, 40 + i)))
  const st2 = I.supertrend(drop, 10, 3).lines
  check('Supertrend flips DOWN after a sharp fall', st2.down[69] != null && st2.up[69] == null && st2.down[69] > drop[69].high)
  check('Up and down are never both set', st2.up.every((v, i) => !(v != null && st2.down[i] != null)))
}

// ── Ichimoku ──
{
  const cs = Array.from({ length: 60 }, (_, i) => C(50, 60 + i, 40 + i, 55, i))
  const ic = I.ichimoku(cs, 9, 26, 52, 26)
  check('Tenkan = (HH9 + LL9)/2', near(ic.lines.tenkan[8], (68 + 40) / 2), String(ic.lines.tenkan[8]))
  check('Kijun starts at bar 25', ic.lines.kijun[24] == null && ic.lines.kijun[25] != null)
  check('Senkou B starts at bar 51', ic.lines.senkouB[50] == null && ic.lines.senkouB[51] != null)
  check('Senkou shifts +26, Chikou −26', ic.shifts.senkouA === 26 && ic.shifts.senkouB === 26 && ic.shifts.chikou === -26)
  check('Senkou A = (Tenkan+Kijun)/2', near(ic.lines.senkouA[30], (ic.lines.tenkan[30] + ic.lines.kijun[30]) / 2))
}

// ── Pivot points ──
{
  const L = I.pivotLevels('classic', 110, 90, 100)
  check('Classic P=100 R1=110 S1=90', near(L.p, 100) && near(L.r1, 110) && near(L.s1, 90))
  check('Classic R2=120 S2=80 R3=130 S3=70', near(L.r2, 120) && near(L.s2, 80) && near(L.r3, 130) && near(L.s3, 70))
  const F = I.pivotLevels('fibonacci', 110, 90, 100)
  check('Fibonacci R1 = P + 0.382·range = 107.64', near(F.r1, 107.64) && near(F.s2, 100 - 0.618 * 20) && near(F.r3, 120))
  const K = I.pivotLevels('camarilla', 110, 90, 100)
  check('Camarilla R1 = C + 1.1·range/12', near(K.r1, 100 + 22 / 12) && near(K.s3, 100 - 22 / 4))
  const day = (d, n, hi, lo, cl) => Array.from({ length: n }, (_, i) => C(cl, i === 1 ? hi : cl, i === 2 ? lo : cl, cl, d * 86400 + i * 3600))
  const cs = [...day(0, 4, 110, 90, 100), ...day(1, 4, 130, 100, 120)]
  const pv = I.pivots(cs, 'classic', 'day', 0).lines
  check('Day 1 uses day 0 levels (P=100 → at bar 5)', near(pv.p[5], (110 + 90 + 100) / 3) && near(pv.r1[5], 2 * (300 / 3) - 90))
  check('First bar of each day is a gap', pv.p[0] == null && pv.p[4] == null)
  check('Day 0 has no levels (no previous day)', pv.p.slice(0, 4).every((v) => v == null))
}

// ── registry / safety ──
{
  check('every indicator has a definition with lines', I.INDICATOR_TYPES.every((t) => I.INDICATOR_DEFS[t].lines.length > 0))
  const cs = getCandles('EURUSD', 'M5', 400)
  let allOk = true
  for (const t of I.INDICATOR_TYPES) {
    const r = I.computeIndicator(t, cs, I.defaultParams(t), { tz: 19800, tfMinutes: 5 })
    for (const k of Object.keys(r.lines)) {
      if (r.lines[k].length !== cs.length) { allOk = false; console.log('  bad length', t, k) }
      if (r.lines[k].some((v) => v != null && !Number.isFinite(v))) { allOk = false; console.log('  non-finite', t, k) }
    }
  }
  check('all 12 indicators run on real feed candles: aligned & finite', allOk)
  check('bad params are clamped, not crashed', (() => { const r = I.computeIndicator('sma', cs, { period: -5 }); return r.lines.v.filter((v) => v != null).length === cs.length })())
  check('garbage params fall back to defaults', I.cleanParams('rsi', { period: 'abc' }).period === 14)
  check('select param rejects unknown option', I.cleanParams('pivots', { type: 'nope' }).type === 'classic')
  check('MACD slow ≤ fast is repaired', (() => { const r = I.computeIndicator('macd', cs, { fast: 30, slow: 10, signal: 9 }); return r.lines.macd.some((v) => v != null) })())
  check('empty candles do not throw', I.INDICATOR_TYPES.every((t) => { try { I.computeIndicator(t, [], I.defaultParams(t), {}); return true } catch { return false } }))
  check('param summary', I.paramSummary('bb', { period: 20, mult: 2 }) === '(20, 2)' && I.paramSummary('vwap', {}) === '')
}

// ── core: incremental ticks match a from-scratch calculation ──
{
  const cs = getCandles('XAUUSD', 'M15', 300)
  const cfgs = [{ id: 'a', type: 'ema', params: { period: 20 } }, { id: 'b', type: 'rsi', params: { period: 14 } }, { id: 'c', type: 'macd', params: {} }, { id: 'd', type: 'supertrend', params: {} }]
  const core = createCore()
  const init = core.init({ candles: cs.slice(0, 250), cfgs, ctx: { tz: 0, tfMinutes: 15 } })
  check('core init returns full results for all', init.full && init.results.length === 4 && init.n === 250)
  let reply
  for (let i = 250; i < 300; i++) {
    const c = cs[i]
    core.tick({ candle: { ...c, close: c.open }, isNew: true }) // new bar opens
    reply = core.tick({ candle: c, isNew: false }) // then ticks to its final value
  }
  const scratch = I.computeIndicator('ema', cs, { period: 20 })
  const tailA = reply.tail.find((t) => t.id === 'a').v.v
  check('tail after 50 incremental bars = from-scratch EMA', near(tailA, scratch.lines.v[299], 1e-9), `${tailA} vs ${scratch.lines.v[299]}`)
  const tailM = reply.tail.find((t) => t.id === 'c').v.macd
  check('tail MACD = from-scratch MACD', near(tailM, I.computeIndicator('macd', cs, {}).lines.macd[299], 1e-9))
  const newBar = core.tick({ candle: { ...cs[299], time: cs[299].time + 900 }, isNew: true })
  check('a new bar returns a full recompute', newBar.full && newBar.n === 301)
  const big = createCore()
  big.init({ candles: Array.from({ length: CANDLE_CAP }, (_, i) => C(1, 1, 1, 1, i)), cfgs: [], ctx: {} })
  const t = big.tick({ candle: C(1, 1, 1, 1, CANDLE_CAP), isNew: true })
  check('core caps its history', t.n < CANDLE_CAP + 1)
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
