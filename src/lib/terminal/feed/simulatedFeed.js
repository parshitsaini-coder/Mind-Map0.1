// Simulated price feed (no API key, no network). Same interface a real feed will use later:
//   getCandles(symbol, tfId, count)  ·  subscribe(symbol, cb)  ·  getMidAt(symbol, tSec)
//
// The price is a pure function of TIME: every minute is generated from a seed
// (symbol + minute index) as a 4-step walk that starts at the previous close, and live
// ticks follow that very same path. So history, live ticks, a page reload and offline
// catch-up all see the SAME prices (open the app tomorrow and the market it replays is
// the one that would have been live). Markets are simulated 24/7.
import { INSTRUMENTS, TIMEFRAMES } from '../instruments.js'
import { applySpread } from '../engine.js'

const ANCHOR_MIN = Math.floor(Date.UTC(2026, 6, 1) / 60000) // 2026-07-01 00:00 UTC, in minutes
const KEEP_MINUTES = 60 * 1440 // keep the last 60 days of M1
const TICK_MS = 250
const REVERT = 0.0004 // pull per minute toward the base price

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
function gauss(rnd) {
  const u = Math.max(rnd(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}
const sigmaMin = (inst) => inst.vol / 100 / Math.sqrt(1440) // per-minute sigma (fraction of price)

// The 4 price points inside minute `m` (open -> p1..p4=close). Pure function of (symbol, m, open).
function genMinute(symbol, inst, m, open) {
  const rnd = mulberry32((hash(symbol) + Math.imul(m, 0x9e3779b1)) >>> 0)
  const sig = sigmaMin(inst)
  const pts = []
  let p = open, hi = open, lo = open
  for (let k = 0; k < 4; k++) {
    p *= 1 + gauss(rnd) * (sig / 2) + ((inst.base - p) / inst.base) * (REVERT / 4)
    pts.push(p)
    if (p > hi) hi = p
    if (p < lo) lo = p
  }
  // tick volume (deterministic): busier when the minute moved more. Drawn AFTER the price steps,
  // so it never changes the price path.
  const vol = Math.round(20 + ((hi - lo) / (open * sig)) * 25 + rnd() * 30)
  return { pts, hi, lo, close: p, vol }
}

const cache = new Map() // symbol -> { t,o,h,l,c arrays (kept window), next (next minute to generate), price }

function ensure(symbol, upToMinute = Math.floor(Date.now() / 60000)) {
  const inst = INSTRUMENTS[symbol]
  let e = cache.get(symbol)
  if (!e) {
    e = { t: [], o: [], h: [], l: [], c: [], v: [], next: ANCHOR_MIN, price: inst.base }
    cache.set(symbol, e)
  }
  // generate every COMPLETED minute (< upToMinute), continuing from the last close
  while (e.next < upToMinute) {
    const g = genMinute(symbol, inst, e.next, e.price)
    if (e.next >= upToMinute - KEEP_MINUTES) {
      e.t.push(e.next * 60); e.o.push(e.price); e.h.push(g.hi); e.l.push(g.lo); e.c.push(g.close); e.v.push(g.vol)
    }
    e.price = g.close
    e.next++
  }
  return e
}

// Aggregate M1 -> timeframe, returning the last `count` candles (completed minutes only).
export function getCandles(symbol, tfId, count = 1500) {
  const tf = TIMEFRAMES.find((x) => x.id === tfId) || TIMEFRAMES[0]
  const m1 = ensure(symbol)
  const bucket = tf.minutes * 60
  const out = []
  let cur = null
  for (let i = 0; i < m1.t.length; i++) {
    const b = Math.floor(m1.t[i] / bucket) * bucket
    if (!cur || cur.time !== b) {
      if (cur) out.push(cur)
      cur = { time: b, open: m1.o[i], high: m1.h[i], low: m1.l[i], close: m1.c[i], volume: m1.v[i] }
    } else {
      if (m1.h[i] > cur.high) cur.high = m1.h[i]
      if (m1.l[i] < cur.low) cur.low = m1.l[i]
      cur.close = m1.c[i]
      cur.volume += m1.v[i]
    }
  }
  if (cur) out.push(cur)
  return out.length > count ? out.slice(out.length - count) : out
}

// Mid price at any moment of the CURRENT or a FUTURE-of-history minute (tSec in seconds).
const minuteMemo = new Map() // symbol -> { m, open, g }
export function getMidAt(symbol, tSec) {
  const inst = INSTRUMENTS[symbol]
  const m = Math.floor(tSec / 60)
  const e = ensure(symbol, m) // makes e.price the close of minute m-1 == open of m
  let memo = minuteMemo.get(symbol)
  if (!memo || memo.m !== m) {
    memo = { m, open: e.price, g: genMinute(symbol, inst, m, e.price) }
    minuteMemo.set(symbol, memo)
  }
  const f = ((tSec - m * 60) / 60) * 4
  const k = Math.min(3, Math.max(0, Math.floor(f)))
  const frac = Math.min(1, Math.max(0, f - k))
  const p0 = k === 0 ? memo.open : memo.g.pts[k - 1]
  const mid = p0 + (memo.g.pts[k] - p0) * frac
  // tiny deterministic jitter so ticks don't look like straight lines
  const jr = mulberry32((hash(symbol) + Math.imul(Math.floor(tSec * (1000 / TICK_MS)), 0x85ebca6b)) >>> 0)
  return mid * (1 + gauss(jr) * sigmaMin(inst) * Math.sqrt(TICK_MS / 60000) * 0.5)
}

// Spread mode (Settings): 'fixed' = the instrument's base spread; 'variable' = it breathes with the
// clock — mostly 1–1.2× base, sometimes ~2×, rarely 3–6× (news-like spikes). Deterministic in
// (symbol, 10-second bucket), so replays / offline catch-up see the same spread the live feed did.
let spreadMode = 'fixed'
export const setSpreadMode = (m) => { spreadMode = m === 'variable' ? 'variable' : 'fixed' }
export const getSpreadMode = () => spreadMode
export function spreadFactor(symbol, time) {
  const r = mulberry32((hash(symbol) ^ Math.imul(Math.floor(time / 10), 0x9e3779b1)) >>> 0)()
  if (r < 0.8) return 1 + r * 0.25
  if (r < 0.97) return 1.5 + (r - 0.8) * 5
  return 3 + (r - 0.97) * 100
}

const quoteOf = (symbol, mid, time = Date.now() / 1000) => {
  const inst = INSTRUMENTS[symbol]
  const spread = spreadMode === 'variable' ? inst.spread * spreadFactor(symbol, time) : inst.spread
  const { bid, ask } = applySpread(mid, spread, inst.digits)
  return { symbol, time, mid, bid, ask, spread }
}

export const quoteFromMid = (symbol, mid, time) => quoteOf(symbol, mid, time)
export const getQuote = (symbol) => {
  const t = Date.now() / 1000
  return quoteOf(symbol, getMidAt(symbol, t), t)
}

// Price ~24h ago, for the "day change" figure.
export function getDayOpen(symbol) {
  const m1 = ensure(symbol)
  return m1.o[Math.max(0, m1.t.length - 1440)]
}

const live = new Map() // symbol -> { subs:Set, timer }
function step(symbol) {
  const s = live.get(symbol)
  const q = getQuote(symbol)
  s.subs.forEach((cb) => cb(q))
}

// Subscribe to live ticks. Returns an unsubscribe function.
export function subscribe(symbol, cb) {
  let s = live.get(symbol)
  if (!s) { s = { subs: new Set(), timer: null }; live.set(symbol, s) }
  s.subs.add(cb)
  if (!s.timer) s.timer = setInterval(() => step(symbol), TICK_MS)
  cb(getQuote(symbol))
  return () => {
    s.subs.delete(cb)
    if (s.subs.size === 0 && s.timer) {
      clearInterval(s.timer)
      s.timer = null
    }
  }
}
