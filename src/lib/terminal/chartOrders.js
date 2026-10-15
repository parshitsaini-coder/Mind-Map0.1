// Pure helpers for managing positions / orders directly on the chart (Phase 10).
// No React, no store: every number shown on the chart comes from engine.js so the overlay and the
// ledger can never disagree. Unit-tested in tests/terminal-phase10.test.mjs.
import * as E from './engine.js'

export const PL_UNITS = ['money', 'pips', 'percent', 'r', 'points']
// The pill chip cycles through these (points stays a Settings-only choice).
export const PL_CYCLE = ['money', 'pips', 'percent', 'r']
export const nextPlUnit = (u) => PL_CYCLE[(PL_CYCLE.indexOf(u) + 1) % PL_CYCLE.length]

const MINUS = '−'
const sign = (n) => (n >= 0 ? '+' : MINUS)
const fixed = (n, d) => Math.abs(n).toFixed(d)
const grouped = (n) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// All the ways to express "price moved from `from` to `to`" for this side / size.
// `riskPrice` (the stop) defines 1R; without it R is null.
export function plFigures({ side, lots, from, to, inst, balance = 0, riskPrice = null, rates }) {
  const money = E.pnl(side, lots, from, to, inst, rates)
  const pips = E.pipsMoved(side, from, to, inst)
  const points = (pips * inst.pipSize) / 10 ** -inst.digits
  const percent = balance > 0 ? (money / balance) * 100 : 0
  const dir = side === 'buy' ? 1 : -1
  const risk = riskPrice != null ? Math.abs(from - riskPrice) : 0
  const r = risk > 0 ? (dir * (to - from)) / risk : null
  return { money, pips, points, percent, r }
}

export function fmtFigure(f, unit) {
  switch (unit) {
    case 'pips': return `${sign(f.pips)}${fixed(f.pips, 1)} pips`
    case 'points': return `${sign(f.points)}${fixed(Math.round(f.points), 0)} pts`
    case 'percent': return `${sign(f.percent)}${fixed(f.percent, 2)}%`
    case 'r': return f.r == null ? 'R —' : `${sign(f.r)}${fixed(f.r, 2)} R`
    default: return `${sign(f.money)}$${grouped(f.money)}`
  }
}

// Tag text for the SL / TP lines: projected result if the level is hit, in every unit at once.
//   SL −$45.00 (−15.0 pips) −0.45 %        TP +$90.00 (+30.0 pips) +0.90 % R 2.0
export function levelTag(kind, f) {
  const base = `${kind} ${fmtFigure(f, 'money')} (${fmtFigure(f, 'pips')}) ${sign(f.percent)}${fixed(f.percent, 2)} %`
  return kind === 'TP' && f.r != null ? `${base} R ${fixed(f.r, 1)}` : base
}

// ── drag validation: the engine's own rules, so a drag never "succeeds" and then fails ──
// kind: 'sl' | 'tp' (open position) · 'order' | 'limit' (pending price) · 'osl' | 'otp' (pending's SL/TP)
export function validateDrag({ kind, price, pos, order, q, inst }) {
  if (!Number.isFinite(price) || price <= 0) return 'Price is off the chart'
  if (!q) return 'Waiting for live price…'
  if (kind === 'sl') return E.validateStops(pos.side, q, price, null, inst)
  if (kind === 'tp') return E.validateStops(pos.side, q, null, price, inst)
  if (kind === 'order') return E.validatePending({ ...order, price }, q, inst)
  if (kind === 'limit') return E.validatePending({ ...order, limitPrice: price }, q, inst)
  const ref = E.orderFillLevel(order)
  if (kind === 'osl') return E.validateStopsAt(order.side, ref, price, null, inst)
  if (kind === 'otp') return E.validateStopsAt(order.side, ref, null, price, inst)
  return null
}

// ── snapping ──
// mode: 'off' | 'round' (nearest 10 pips) | 'bars' (nearest high / low of `levels` within `tol`).
// fine (Shift): one tick.   coarse (Ctrl): 10 pips.
export function snapPrice(price, { mode = 'off', inst, levels = [], tol = 0, fine = false, coarse = false }) {
  const tick = 10 ** -inst.digits
  const r = (n) => Number(n.toFixed(inst.digits))
  if (fine) return r(Math.round(price / tick) * tick)
  if (coarse) { const s = inst.pipSize * 10; return r(Math.round(price / s) * s) }
  if (mode === 'round') { const s = inst.pipSize * 10; return r(Math.round(price / s) * s) }
  if (mode === 'bars' && levels.length) {
    let best = null
    for (const l of levels) { const d = Math.abs(l - price); if (d <= tol && (best == null || d < best.d)) best = { l, d } }
    if (best) return r(best.l)
  }
  return r(price)
}

// High / low of the last `n` bars — the levels the "bars" snap uses.
export function barLevels(candles, n = 120) {
  const out = []
  for (let i = Math.max(0, candles.length - n); i < candles.length; i++) { out.push(candles[i].high, candles[i].low) }
  return out
}

// Dragging an SL close to the entry price clicks onto the entry (break-even), within `zonePips`.
export function breakEvenSnap(price, entry, inst, zonePips = 1.5) {
  return Math.abs(price - entry) <= zonePips * inst.pipSize + 1e-9 * inst.pipSize ? entry : price
}

// ── default SL / TP distance (Settings → Trading) ──
export function atrOf(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null
  let sum = 0
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i], pc = candles[i - 1].close
    sum += Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc))
  }
  return sum / period
}

// unit: 'pips' | 'percent' | 'atr'. Returns { price } or { error }.
export function defaultStop({ kind, side, entry, inst, unit, value, atr = null }) {
  let dist
  if (unit === 'pips') dist = value * inst.pipSize
  else if (unit === 'percent') dist = (entry * value) / 100
  else if (unit === 'atr') { if (!(atr > 0)) return { error: 'Not enough bars to measure ATR' }; dist = atr * value }
  else return { error: 'Unknown unit' }
  if (!(dist > 0)) return { error: 'Default distance must be above 0' }
  const below = (kind === 'sl') === (side === 'buy')
  return { price: Number((below ? entry - dist : entry + dist).toFixed(inst.digits)) }
}

// ── custom partial close ──
export function validateCloseLots(posLots, lots, inst) {
  const err = E.validateLots(lots, inst)
  if (err) return err
  if (lots >= posLots - 1e-9) return 'Use Close to close the whole position'
  if (posLots - lots < inst.minLot - 1e-9) return `At least ${inst.minLot} lot must stay open`
  return null
}

// ── account strip ──
export function marginState(level, warn, stopOut) {
  if (level == null) return 'none'
  if (level < stopOut) return 'danger'
  if (level < warn) return 'warn'
  return 'ok'
}

// ── undo stack for chart modifications (kept small; an entry older than `ttlMs` is not offered) ──
export function createUndo(max = 20) {
  let stack = []
  return {
    push: (e, now = Date.now()) => { stack = [...stack.slice(-(max - 1)), { ...e, at: now }] },
    pop: () => { const e = stack[stack.length - 1]; stack = stack.slice(0, -1); return e || null },
    peek: () => stack[stack.length - 1] || null,
    drop: (id) => { stack = stack.filter((e) => e.id !== id) },
    size: () => stack.length,
    clear: () => { stack = [] },
  }
}

// y-pixel helpers for the overlay: spread pills that would sit on top of each other.
export function spreadY(items, minGap, lo, hi) {
  const sorted = [...items].sort((a, b) => a.y - b.y)
  let prev = lo - minGap
  for (const it of sorted) { it.ry = Math.max(it.y, prev + minGap); prev = it.ry }
  // if the stack ran past the bottom, pull it back up
  let next = hi + minGap
  for (let i = sorted.length - 1; i >= 0; i--) { sorted[i].ry = Math.min(sorted[i].ry, next - minGap); next = sorted[i].ry }
  return sorted
}
