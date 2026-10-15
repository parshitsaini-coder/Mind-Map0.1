// Phase 10 — pure maths for the on-chart position overlay (pills, SL/TP tags, drag rules).
// No React, no chart library, no I/O. Every number comes from engine.js so what the chart shows is
// exactly what the ledger will book (tests/terminal-phase10.test.mjs checks that to the cent).
import * as E from './engine.js'

export const PL_UNITS = ['money', 'pips', 'points', 'percent', 'r']
// an unknown unit is displayed as money, so its "next" is pips
export const nextPlUnit = (u) => PL_UNITS[(Math.max(0, PL_UNITS.indexOf(u)) + 1) % PL_UNITS.length]
export const PL_UNIT_LABEL = { money: '$', pips: 'pips', points: 'pts', percent: '% bal', r: 'R' }

const MINUS = '\u2212'
export const sgn = (n) => (n > 0 ? '+' : n < 0 ? MINUS : '')
const money = (n) => `${sgn(n)}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// price units per "point" (smallest price step shown by the instrument)
const pointSize = (inst) => 10 ** -inst.digits

// All the numbers for "this position closes at `exit`".
//   risk — what the stop loss would lose (USD, positive) or null without a stop (needed for R)
export function plNumbers({ side, lots, entry, exit, sl = null, inst, rates, balance = 0 }) {
  const pl = E.roundMoney(E.pnl(side, lots, entry, exit, inst, rates))
  const pips = Math.round(E.pipsMoved(side, entry, exit, inst) * 10) / 10
  const points = Math.round((((side === 'buy' ? 1 : -1) * (exit - entry)) / pointSize(inst)))
  const percent = balance > 0 ? (pl / balance) * 100 : null
  const risk = sl != null ? Math.abs(E.pnl(side, lots, entry, sl, inst, rates)) : null
  const r = risk > 0 ? pl / risk : null
  return { pl, pips, points, percent, r, risk }
}

// One short text for the chip, in the unit the person chose. Always signed.
export function fmtPl(n, unit) {
  switch (unit) {
    case 'pips': return `${sgn(n.pips)}${Math.abs(n.pips).toFixed(1)}p`
    case 'points': return `${sgn(n.points)}${Math.abs(n.points)} pts`
    case 'percent': return n.percent == null ? '—' : `${sgn(n.percent)}${Math.abs(n.percent).toFixed(2)}%`
    case 'r': return n.r == null ? 'R —' : `${sgn(n.r)}${Math.abs(n.r).toFixed(2)}R`
    default: return money(n.pl)
  }
}

// Right-edge tag of an SL / TP line, e.g. "SL −$45.00 (−15.0 pips) −0.45 %" or
// "TP +$90.00 (+30.0 pips) +0.90 % R 2.0". `ref` is the price the P/L is measured from
// (entry for a position, the order price for a pending order).
export function slTpTag(kind, { side, lots, ref, price, sl = null, inst, rates, balance }) {
  const n = plNumbers({ side, lots, entry: ref, exit: price, sl: kind === 'tp' ? sl : null, inst, rates, balance })
  let t = `${kind.toUpperCase()} ${money(n.pl)} (${sgn(n.pips)}${Math.abs(n.pips).toFixed(1)} pips)`
  if (n.percent != null) t += ` ${sgn(n.percent)}${Math.abs(n.percent).toFixed(2)} %`
  if (kind === 'tp' && n.r != null) t += ` R ${Math.abs(n.r).toFixed(1)}`
  return t
}

// R-multiple of a TP relative to a given SL (reward : risk). null when there is no stop.
export function rewardRisk({ side, lots, entry, sl, tp, inst, rates }) {
  if (sl == null || tp == null) return null
  const risk = Math.abs(E.pnl(side, lots, entry, sl, inst, rates))
  const reward = Math.abs(E.pnl(side, lots, entry, tp, inst, rates))
  return risk > 0 ? reward / risk : null
}

// ── drag validation ──────────────────────────────────────────────────────
// Mirrors the ledger's rules (so a drag that looks valid will be accepted) and adds one UI-only
// rule: a minimum distance from the price the order would close/fill at.
//   target.kind: 'sl' | 'tp'            (position)       reference: the live quote
//                'osl' | 'otp'          (pending order)  reference: the order's own price
//                'order'                (pending price)  checked with E.validatePending
export const MIN_DIST_PIPS = 1

export function validateDrag(target, price, ctx) {
  const { inst, quote: q } = ctx
  const d = inst.digits
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'Invalid price' }
  const min = (ctx.minPips ?? MIN_DIST_PIPS) * inst.pipSize
  const need = (side, ref, kind) => { // kind 'sl' | 'tp'; returns reason or null
    const buy = side === 'buy'
    const below = (kind === 'sl') === buy
    if (below) {
      if (!(price < ref)) return `${kind === 'sl' ? 'SL' : 'TP'} must be below ${ref.toFixed(d)}`
      if (ref - price < min - 1e-12) return `Too close — keep ${ctx.minPips ?? MIN_DIST_PIPS} pip away`
    } else {
      if (!(price > ref)) return `${kind === 'sl' ? 'SL' : 'TP'} must be above ${ref.toFixed(d)}`
      if (price - ref < min - 1e-12) return `Too close — keep ${ctx.minPips ?? MIN_DIST_PIPS} pip away`
    }
    return null
  }
  let reason = null
  if (target.kind === 'sl' || target.kind === 'tp') {
    if (!q) return { ok: false, reason: 'Waiting for live price…' }
    const ref = target.side === 'buy' ? q.bid : q.ask // the ledger checks against the closing price
    reason = need(target.side, ref, target.kind)
  } else if (target.kind === 'osl' || target.kind === 'otp') {
    reason = need(target.side, target.ref, target.kind === 'osl' ? 'sl' : 'tp')
  } else if (target.kind === 'order' || target.kind === 'limit') {
    if (!q) return { ok: false, reason: 'Waiting for live price…' }
    const o = target.order
    reason = E.validatePending({ type: o.type, side: o.side, price: target.kind === 'order' ? price : o.price, limitPrice: target.kind === 'limit' ? price : o.limitPrice }, q, inst)
  } else return { ok: false, reason: 'Unknown line' }
  return reason ? { ok: false, reason } : { ok: true, reason: null }
}

// ── snapping ─────────────────────────────────────────────────────────────
// mode 'off' | 'round' | 'bars'.  `fine` (Shift) disables snapping and steps one tick;
// `coarse` (Ctrl) multiplies the round step by 10.
export const roundStep = (inst) => inst.pipSize * 10 // 10 pips: 1.0 gold, 0.0010 EURUSD, 0.10 JPY, 10 NIFTY pts

export function snapPrice(price, { mode = 'off', inst, bars = [], fine = false, coarse = false, tolPips = 4 }) {
  const tick = pointSize(inst)
  if (fine) return Number((Math.round(price / tick) * tick).toFixed(inst.digits))
  if (mode === 'round' || coarse) {
    const step = roundStep(inst) * (coarse ? 10 : 1)
    return Number((Math.round(price / step) * step).toFixed(inst.digits))
  }
  if (mode === 'bars') {
    const tol = tolPips * inst.pipSize
    let best = null
    for (const b of bars.slice(-60)) for (const v of [b.high, b.low]) {
      const dist = Math.abs(v - price)
      if (dist <= tol && (best == null || dist < best.dist)) best = { v, dist }
    }
    if (best) return Number(best.v.toFixed(inst.digits))
  }
  return Number(price.toFixed(inst.digits))
}

// Magnetic break-even: dragging an SL to within `zonePips` of the entry snaps it onto the entry.
export function breakEvenSnap(price, entry, inst, zonePips = 2) {
  return Math.abs(price - entry) <= zonePips * inst.pipSize ? Number(entry.toFixed(inst.digits)) : price
}

// ── default SL / TP distances (Settings → Trading) ───────────────────────
// unit 'pips' | 'percent' | 'atr' ; atr = the latest ATR value in PRICE units (or null).
export function defaultStop(kind, { side, ref, unit, value, atr = null, inst }) {
  let dist
  if (unit === 'percent') dist = ref * (value / 100)
  else if (unit === 'atr') { if (!(atr > 0)) return { error: 'ATR not ready yet — pick pips or %' }; dist = atr * value }
  else dist = value * inst.pipSize
  if (!(dist > 0)) return { error: 'Set a default distance in Settings' }
  const below = (kind === 'sl') === (side === 'buy')
  return { price: Number((below ? ref - dist : ref + dist).toFixed(inst.digits)) }
}

// ── account strip ────────────────────────────────────────────────────────
// 'ok' | 'warn' (margin level under the warning threshold) | 'danger' (under stop-out) | 'none'
export function marginState(level, warnLevel = 100, stopOutLevel = 50) {
  if (level == null) return 'none'
  if (level < stopOutLevel) return 'danger'
  if (level < warnLevel) return 'warn'
  return 'ok'
}

// ── undo for the last SL/TP move ─────────────────────────────────────────
// A tiny pure stack so the store only has to hold { stack }.  Entries: { target:'position'|'order', id, prev, label }
export const UNDO_LIMIT = 20
export const pushUndo = (stack, entry) => [...(stack || []).slice(-(UNDO_LIMIT - 1)), entry]
export const popUndo = (stack) => (stack && stack.length ? { entry: stack[stack.length - 1], stack: stack.slice(0, -1) } : { entry: null, stack: stack || [] })
// Only the keys of `patch` are remembered, with their values BEFORE the change.
export const prevOf = (obj, patch) => Object.fromEntries(Object.keys(patch).map((k) => [k, obj[k] ?? null]))
