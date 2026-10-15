// Technical indicators for the demo terminal — PURE functions, no DOM, no chart library.
// Every function takes plain arrays and returns arrays of the same length (null = "no value yet").
//
// A computed indicator looks like:
//   { lines: { key: (number|null)[] }, shifts?: { key: bars } }
// `shifts` is only used by Ichimoku (Senkou +N bars into the future, Chikou −N bars into the past):
// value i of that line is plotted at bar (i + shift).
//
// Conventions (so results are comparable with common charting packages):
//   SMA/EMA/WMA  – EMA is seeded with the SMA of the first `period` values.
//   Bollinger    – population standard deviation.
//   RSI/ATR      – Wilder smoothing, seeded with a simple average.
//   Stochastic   – (%K period, slowing, %D period) = (14, 3, 3) by default.
//   Supertrend   – ATR(Wilder) bands, classic flip rule.
//   Ichimoku     – 9 / 26 / 52, displacement 26 (Senkou plotted +26, Chikou −26).
//   Pivot points – from the PREVIOUS session (day; week on the daily chart).
//   VWAP         – resets every local day; uses tick volume (the simulated feed has no real volume).

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// ── primitives ─────────────────────────────────────────────────────────────
export function sma(values, period) {
  const out = new Array(values.length).fill(null)
  let sum = 0
  let run = 0 // consecutive valid values in the window
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!isNum(v)) { sum = 0; run = 0; continue }
    sum += v
    run++
    if (run > period) sum -= values[i - period]
    if (run >= period) out[i] = sum / period
  }
  return out
}

// EMA that skips leading nulls and seeds with the SMA of the first `period` valid values.
export function ema(values, period) {
  const out = new Array(values.length).fill(null)
  const k = 2 / (period + 1)
  let prev = null
  let seedSum = 0
  let seedN = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!isNum(v)) continue
    if (prev == null) {
      seedSum += v
      seedN++
      if (seedN === period) { prev = seedSum / period; out[i] = prev }
    } else {
      prev = v * k + prev * (1 - k)
      out[i] = prev
    }
  }
  return out
}

export function wma(values, period) {
  const out = new Array(values.length).fill(null)
  const denom = (period * (period + 1)) / 2
  for (let i = period - 1; i < values.length; i++) {
    let s = 0
    let ok = true
    for (let j = 0; j < period; j++) {
      const v = values[i - period + 1 + j]
      if (!isNum(v)) { ok = false; break }
      s += v * (j + 1)
    }
    if (ok) out[i] = s / denom
  }
  return out
}

// Wilder's smoothing (RMA), seeded with the simple average of the first `period` values.
function rma(values, period) {
  const out = new Array(values.length).fill(null)
  let prev = null
  let seedSum = 0
  let seedN = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!isNum(v)) continue
    if (prev == null) {
      seedSum += v
      seedN++
      if (seedN === period) { prev = seedSum / period; out[i] = prev }
    } else {
      prev = (prev * (period - 1) + v) / period
      out[i] = prev
    }
  }
  return out
}

const closes = (c) => c.map((k) => k.close)

// highest high / lowest low over a trailing window ending at i (inclusive)
function windowExtreme(arr, i, period, fn) {
  if (i < period - 1) return null
  let r = arr[i]
  for (let j = i - period + 1; j < i; j++) r = fn(r, arr[j])
  return r
}

// ── indicators ─────────────────────────────────────────────────────────────
export function bollinger(candles, period = 20, mult = 2) {
  const cl = closes(candles)
  const mid = sma(cl, period)
  const upper = new Array(cl.length).fill(null)
  const lower = new Array(cl.length).fill(null)
  for (let i = period - 1; i < cl.length; i++) {
    if (mid[i] == null) continue
    let v = 0
    for (let j = i - period + 1; j <= i; j++) v += (cl[j] - mid[i]) ** 2
    const sd = Math.sqrt(v / period)
    upper[i] = mid[i] + mult * sd
    lower[i] = mid[i] - mult * sd
  }
  return { lines: { upper, mid, lower } }
}

export function rsi(candles, period = 14) {
  const cl = closes(candles)
  const out = new Array(cl.length).fill(null)
  let avgG = 0
  let avgL = 0
  for (let i = 1; i < cl.length; i++) {
    const ch = cl[i] - cl[i - 1]
    const g = ch > 0 ? ch : 0
    const l = ch < 0 ? -ch : 0
    if (i <= period) {
      avgG += g
      avgL += l
      if (i === period) { avgG /= period; avgL /= period }
    } else {
      avgG = (avgG * (period - 1) + g) / period
      avgL = (avgL * (period - 1) + l) / period
    }
    if (i >= period) out[i] = avgL === 0 ? (avgG === 0 ? 50 : 100) : 100 - 100 / (1 + avgG / avgL)
  }
  return { lines: { rsi: out } }
}

export function macd(candles, fast = 12, slow = 26, signalP = 9) {
  const cl = closes(candles)
  const ef = ema(cl, fast)
  const es = ema(cl, slow)
  const line = cl.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null))
  const signal = ema(line, signalP)
  const hist = line.map((v, i) => (v != null && signal[i] != null ? v - signal[i] : null))
  return { lines: { macd: line, signal, hist } }
}

export function stochastic(candles, kPeriod = 14, slowing = 3, dPeriod = 3) {
  const hi = candles.map((c) => c.high)
  const lo = candles.map((c) => c.low)
  const raw = candles.map((c, i) => {
    const hh = windowExtreme(hi, i, kPeriod, Math.max)
    const ll = windowExtreme(lo, i, kPeriod, Math.min)
    if (hh == null) return null
    return hh === ll ? 50 : ((c.close - ll) / (hh - ll)) * 100
  })
  const k = slowing > 1 ? sma(raw, slowing) : raw
  const d = sma(k, dPeriod)
  return { lines: { k, d } }
}

// Volume histogram + its moving average (tick volume of the simulated feed).
export function volumeInd(candles, maPeriod = 20) {
  const v = candles.map((c) => (isNum(c.volume) ? c.volume : 0))
  return { lines: { vol: v, ma: sma(v, maPeriod) } }
}

// Stochastic RSI: the stochastic formula applied to RSI. %K = SMA(raw, k), %D = SMA(%K, d).
export function stochRsi(candles, rsiP = 14, stochP = 14, kP = 3, dP = 3) {
  const r = rsi(candles, rsiP).lines.rsi
  const raw = r.map((v, i) => {
    if (v == null || i < stochP - 1) return null
    let hh = -Infinity, ll = Infinity
    for (let j = i - stochP + 1; j <= i; j++) { if (r[j] == null) return null; hh = Math.max(hh, r[j]); ll = Math.min(ll, r[j]) }
    return hh === ll ? 50 : ((v - ll) / (hh - ll)) * 100
  })
  const k = kP > 1 ? sma(raw, kP) : raw
  return { lines: { k, d: sma(k, dP) } }
}

export function trueRange(candles) {
  return candles.map((c, i) => (i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close))))
}

export function atr(candles, period = 14) {
  return { lines: { atr: rma(trueRange(candles), period) } }
}

// Local-day key (tz = seconds east of UTC, as the chart displays time).
const dayKey = (t, tz) => Math.floor((t + tz) / 86400)
// 1970-01-01 was a Thursday, so +3 aligns weeks to Monday.
const weekKey = (t, tz) => Math.floor((Math.floor((t + tz) / 86400) + 3) / 7)

export function vwap(candles, tz = 0) {
  const out = new Array(candles.length).fill(null)
  const hasVolume = candles.some((c) => isNum(c.volume) && c.volume > 0)
  if (!hasVolume) return { lines: { vwap: out }, meta: { noVolume: true } }
  let day = null
  let pv = 0
  let vol = 0
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const k = dayKey(c.time, tz)
    if (k !== day) { day = k; pv = 0; vol = 0 }
    const v = isNum(c.volume) ? c.volume : 0
    pv += ((c.high + c.low + c.close) / 3) * v
    vol += v
    out[i] = vol > 0 ? pv / vol : null
  }
  return { lines: { vwap: out } }
}

export function supertrend(candles, period = 10, mult = 3) {
  const n = candles.length
  const up = new Array(n).fill(null) // drawn green: trend is up (line under price)
  const down = new Array(n).fill(null) // drawn red: trend is down (line over price)
  const a = rma(trueRange(candles), period)
  let fu = null
  let fl = null
  let trend = 1
  for (let i = 0; i < n; i++) {
    if (a[i] == null) continue
    const c = candles[i]
    const hl2 = (c.high + c.low) / 2
    const bu = hl2 + mult * a[i]
    const bl = hl2 - mult * a[i]
    if (fu == null) {
      fu = bu
      fl = bl
      trend = c.close >= hl2 ? 1 : -1
    } else {
      const pc = candles[i - 1].close
      fu = bu < fu || pc > fu ? bu : fu
      fl = bl > fl || pc < fl ? bl : fl
      if (trend === 1 && c.close < fl) trend = -1
      else if (trend === -1 && c.close > fu) trend = 1
    }
    if (trend === 1) up[i] = fl
    else down[i] = fu
  }
  return { lines: { up, down } }
}

export function ichimoku(candles, tenkanP = 9, kijunP = 26, senkouBP = 52, displacement = 26) {
  const hi = candles.map((c) => c.high)
  const lo = candles.map((c) => c.low)
  const mid = (p) => candles.map((_, i) => {
    const h = windowExtreme(hi, i, p, Math.max)
    const l = windowExtreme(lo, i, p, Math.min)
    return h == null ? null : (h + l) / 2
  })
  const tenkan = mid(tenkanP)
  const kijun = mid(kijunP)
  const senkouA = candles.map((_, i) => (tenkan[i] != null && kijun[i] != null ? (tenkan[i] + kijun[i]) / 2 : null))
  const senkouB = mid(senkouBP)
  const chikou = closes(candles)
  return {
    lines: { tenkan, kijun, senkouA, senkouB, chikou },
    shifts: { senkouA: displacement, senkouB: displacement, chikou: -displacement },
  }
}

// Pivot levels from a previous session's high / low / close.
export function pivotLevels(type, h, l, c) {
  const range = h - l
  if (type === 'fibonacci') {
    const p = (h + l + c) / 3
    return { p, r1: p + 0.382 * range, r2: p + 0.618 * range, r3: p + range, s1: p - 0.382 * range, s2: p - 0.618 * range, s3: p - range }
  }
  if (type === 'camarilla') {
    return {
      p: (h + l + c) / 3,
      r1: c + (range * 1.1) / 12, r2: c + (range * 1.1) / 6, r3: c + (range * 1.1) / 4,
      s1: c - (range * 1.1) / 12, s2: c - (range * 1.1) / 6, s3: c - (range * 1.1) / 4,
    }
  }
  const p = (h + l + c) / 3 // classic
  return { p, r1: 2 * p - l, r2: p + range, r3: h + 2 * (p - l), s1: 2 * p - h, s2: p - range, s3: l - 2 * (h - p) }
}

// Pivot points for each candle = levels of the previous session. The first bar of every
// session is null so the flat lines do not join across days.
// periodOf: 'day' (intraday charts) | 'week' (daily chart).
export function pivots(candles, type = 'classic', periodOf = 'day', tz = 0) {
  const keys = ['p', 'r1', 'r2', 'r3', 's1', 's2', 's3']
  const lines = Object.fromEntries(keys.map((k) => [k, new Array(candles.length).fill(null)]))
  const keyFn = periodOf === 'week' ? weekKey : dayKey
  let cur = null
  let sess = null // { h, l, c } of the session being built
  let prev = null // completed previous session
  let levels = null
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const k = keyFn(c.time, tz)
    if (k !== cur) {
      if (sess) prev = sess
      levels = prev ? pivotLevels(type, prev.h, prev.l, prev.c) : null
      sess = { h: c.high, l: c.low, c: c.close }
      cur = k
      continue // first bar of a session stays null (visual break)
    }
    sess.h = Math.max(sess.h, c.high)
    sess.l = Math.min(sess.l, c.low)
    sess.c = c.close
    if (levels) for (const key of keys) lines[key][i] = levels[key]
  }
  return { lines }
}

// ── registry ───────────────────────────────────────────────────────────────
// `where`: 'overlay' (on the price chart) or 'pane' (own sub-chart).
// lines[].kind: 'line' | 'hist'.  `fixed` pins a pane's scale, `levels` draws guide lines.
const num = (key, label, def, min, max, step = 1) => ({ key, label, def, min, max, step })

export const INDICATOR_DEFS = {
  sma: { name: 'SMA', long: 'Simple Moving Average', where: 'overlay', params: [num('period', 'Period', 20, 1, 500)], lines: [{ key: 'v', label: 'SMA', color: '#facc15' }] },
  ema: { name: 'EMA', long: 'Exponential Moving Average', where: 'overlay', params: [num('period', 'Period', 20, 1, 500)], lines: [{ key: 'v', label: 'EMA', color: '#38bdf8' }] },
  wma: { name: 'WMA', long: 'Weighted Moving Average', where: 'overlay', params: [num('period', 'Period', 20, 1, 500)], lines: [{ key: 'v', label: 'WMA', color: '#fb923c' }] },
  bb: {
    name: 'BB', long: 'Bollinger Bands', where: 'overlay', params: [num('period', 'Period', 20, 2, 500), num('mult', 'Std dev', 2, 0.1, 10, 0.1)],
    lines: [{ key: 'upper', label: 'Upper', color: '#a78bfa' }, { key: 'mid', label: 'Middle', color: '#c4b5fd', dash: true }, { key: 'lower', label: 'Lower', color: '#a78bfa' }],
    fill: { top: 'upper', bottom: 'lower' },
  },
  vwap: { name: 'VWAP', long: 'Volume Weighted Avg Price (daily, tick volume)', where: 'overlay', params: [], lines: [{ key: 'vwap', label: 'VWAP', color: '#f472b6' }] },
  supertrend: {
    name: 'Supertrend', long: 'Supertrend', where: 'overlay', params: [num('period', 'ATR period', 10, 1, 200), num('mult', 'Multiplier', 3, 0.1, 20, 0.1)],
    lines: [{ key: 'up', label: 'Up', color: '#22c55e', width: 2 }, { key: 'down', label: 'Down', color: '#ef4444', width: 2 }],
  },
  ichimoku: {
    name: 'Ichimoku', long: 'Ichimoku Cloud', where: 'overlay',
    params: [num('tenkan', 'Tenkan', 9, 1, 200), num('kijun', 'Kijun', 26, 1, 300), num('senkouB', 'Senkou B', 52, 1, 500), num('disp', 'Displacement', 26, 1, 100)],
    lines: [
      { key: 'tenkan', label: 'Tenkan', color: '#38bdf8' }, { key: 'kijun', label: 'Kijun', color: '#f43f5e' },
      { key: 'senkouA', label: 'Senkou A', color: '#22c55e' }, { key: 'senkouB', label: 'Senkou B', color: '#ef4444' },
      { key: 'chikou', label: 'Chikou', color: '#a3a3a3', dash: true },
    ],
    cloud: { a: 'senkouA', b: 'senkouB' },
  },
  pivots: {
    name: 'Pivots', long: 'Pivot Points (previous day; previous week on 1D)', where: 'overlay',
    params: [{ key: 'type', label: 'Type', def: 'classic', options: ['classic', 'fibonacci', 'camarilla'] }],
    lines: [
      { key: 'r3', label: 'R3', color: '#f87171' }, { key: 'r2', label: 'R2', color: '#f87171' }, { key: 'r1', label: 'R1', color: '#f87171' },
      { key: 'p', label: 'Pivot', color: '#fbbf24' },
      { key: 's1', label: 'S1', color: '#4ade80' }, { key: 's2', label: 'S2', color: '#4ade80' }, { key: 's3', label: 'S3', color: '#4ade80' },
    ],
    noAutoscale: true,
  },
  rsi: {
    name: 'RSI', long: 'Relative Strength Index', where: 'pane', params: [num('period', 'Period', 14, 2, 200)],
    lines: [{ key: 'rsi', label: 'RSI', color: '#a78bfa' }], fixed: [0, 100], levels: [30, 70],
  },
  macd: {
    name: 'MACD', long: 'MACD', where: 'pane', params: [num('fast', 'Fast', 12, 1, 200), num('slow', 'Slow', 26, 2, 400), num('signal', 'Signal', 9, 1, 100)],
    lines: [{ key: 'hist', label: 'Histogram', color: '#64748b', kind: 'hist' }, { key: 'macd', label: 'MACD', color: '#38bdf8' }, { key: 'signal', label: 'Signal', color: '#fb923c' }],
    levels: [0],
  },
  stoch: {
    name: 'Stoch', long: 'Stochastic Oscillator', where: 'pane', params: [num('k', '%K period', 14, 1, 200), num('slowing', 'Slowing', 3, 1, 50), num('d', '%D period', 3, 1, 50)],
    lines: [{ key: 'k', label: '%K', color: '#38bdf8' }, { key: 'd', label: '%D', color: '#fb923c' }], fixed: [0, 100], levels: [20, 80],
  },
  volume: {
    name: 'Volume', long: 'Volume with moving average (tick volume)', where: 'pane', params: [num('ma', 'MA period', 20, 1, 500)],
    lines: [{ key: 'vol', label: 'Volume', color: '#64748b', kind: 'hist' }, { key: 'ma', label: 'MA', color: '#f59e0b' }], volumeHist: true,
  },
  stochrsi: {
    name: 'StochRSI', long: 'Stochastic RSI', where: 'pane',
    params: [num('rsi', 'RSI period', 14, 2, 200), num('stoch', 'Stochastic period', 14, 2, 200), num('k', '%K smoothing', 3, 1, 50), num('d', '%D smoothing', 3, 1, 50)],
    lines: [{ key: 'k', label: '%K', color: '#38bdf8' }, { key: 'd', label: '%D', color: '#fb923c' }], fixed: [0, 100], levels: [20, 80],
  },
  atr: { name: 'ATR', long: 'Average True Range', where: 'pane', params: [num('period', 'Period', 14, 1, 200)], lines: [{ key: 'atr', label: 'ATR', color: '#f59e0b' }] },
}

export const INDICATOR_TYPES = Object.keys(INDICATOR_DEFS)

export const defaultParams = (type) => Object.fromEntries(INDICATOR_DEFS[type].params.map((p) => [p.key, p.def]))

// Clamp user-entered params into their allowed range (bad input never reaches the maths).
export function cleanParams(type, params = {}) {
  const out = {}
  for (const p of INDICATOR_DEFS[type].params) {
    const raw = params[p.key]
    if (p.options) { out[p.key] = p.options.includes(raw) ? raw : p.def; continue }
    let v = Number(raw)
    if (!Number.isFinite(v)) v = p.def
    v = Math.min(p.max, Math.max(p.min, v))
    out[p.key] = p.step < 1 ? Math.round(v / p.step) * p.step : Math.round(v)
  }
  return out
}

// One entry point for the worker and for tests. ctx = { tz (sec), tfMinutes }.
export function computeIndicator(type, candles, params = {}, ctx = {}) {
  const p = cleanParams(type, params)
  const tz = ctx.tz || 0
  switch (type) {
    case 'sma': return { lines: { v: sma(closes(candles), p.period) } }
    case 'ema': return { lines: { v: ema(closes(candles), p.period) } }
    case 'wma': return { lines: { v: wma(closes(candles), p.period) } }
    case 'bb': return bollinger(candles, p.period, p.mult)
    case 'vwap': return vwap(candles, tz)
    case 'supertrend': return supertrend(candles, p.period, p.mult)
    case 'ichimoku': return ichimoku(candles, p.tenkan, p.kijun, p.senkouB, p.disp)
    case 'pivots': return pivots(candles, p.type, (ctx.tfMinutes || 0) >= 1440 ? 'week' : 'day', tz)
    case 'rsi': return rsi(candles, p.period)
    case 'macd': return macd(candles, p.fast, Math.max(p.slow, p.fast + 1), p.signal)
    case 'stoch': return stochastic(candles, p.k, p.slowing, p.d)
    case 'volume': return volumeInd(candles, p.ma)
    case 'stochrsi': return stochRsi(candles, p.rsi, p.stoch, p.k, p.d)
    case 'atr': return atr(candles, p.period)
    default: return { lines: {} }
  }
}

// Short "(20, 2)" text for lists.
export const paramSummary = (type, params) => {
  const vals = INDICATOR_DEFS[type].params.map((p) => params?.[p.key] ?? p.def)
  return vals.length ? `(${vals.join(', ')})` : ''
}

// Hard limit so a corrupted / hand-edited saved list can't flood the chart.
export const MAX_INDICATORS = 12
