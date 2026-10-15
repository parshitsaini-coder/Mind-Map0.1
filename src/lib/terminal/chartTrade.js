// Phase 10 (pure logic): everything the on-chart position desk needs that is not drawing.
// Projected P/L tags, drag validation, snapping, break-even magnet, default SL/TP distances,
// margin state and the undo stack. No React, no chart, no store — unit-tested in
// tests/terminal-phase10.test.mjs. Money maths always goes through engine.pnl() so the tags
// equal the ledger to the cent.
import * as E from './engine.js'

const SIGN_MINUS = '−'
const sgn = (n) => (n < 0 ? SIGN_MINUS : '+')
// toFixed + a regex is ~20x faster than Intl; values are already rounded to cents upstream.
const abs2 = (n) => Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// ── P/L unit cycle (click the chip: money → pips → % of balance → R) ─────
export const PL_CYCLE = ['money', 'pips', 'percent', 'r']
export const nextPlUnit = (u) => {
  if (u === 'points') return 'percent'
  const i = PL_CYCLE.indexOf(u)
  return PL_CYCLE[(i + 1) % PL_CYCLE.length] // unknown -> index -1 -> 'money'
}

// Money lost if the stop is hit (positive number), or null without a stop.
export function riskMoney(side, lots, entry, sl, inst, rates) {
  if (sl == null) return null
  return Math.abs(E.pnl(side, lots, entry, sl, inst, rates))
}

// Everything about "what if the position closes at `price`", measured from `ref` (entry price).
// money is rounded to cents exactly like settleClose, so it equals the closed trade's P/L.
export function plFigures({ side, lots, ref, price, inst, rates, balance, risk = null }) {
  const money = E.roundMoney(E.pnl(side, lots, ref, price, inst, rates))
  const pips = Math.round(E.pipsMoved(side, ref, price, inst) * 10) / 10
  const pct = balance > 0 ? (money / balance) * 100 : 0
  const r = risk > 0 ? money / risk : null
  return { money, pips, pct, r }
}

const fmtMoneyTxt = (n) => `${sgn(n)}$${abs2(n)}`
const fmtPipsTxt = (n) => `${sgn(n)}${Math.abs(n).toFixed(1)} pips`
const fmtPctTxt = (n) => `${sgn(n)}${Math.abs(n).toFixed(2)} %`
const fmtRTxt = (n) => `${sgn(n)}${Math.abs(n).toFixed(1)} R`

// Short text for the P/L chip in the chosen unit. R without a stop falls back to money.
export function plChipText(f, unit) {
  if (unit === 'pips' || unit === 'points') return fmtPipsTxt(f.pips)
  if (unit === 'percent') return fmtPctTxt(f.pct)
  if (unit === 'r' && f.r != null) return fmtRTxt(f.r)
  return fmtMoneyTxt(f.money)
}

// Right-edge tag of an SL / TP line, e.g.  "SL −$45.00 (−15.0 pips) −0.45 %"  /  "TP +$90.00 (+30.0 pips) +0.90 % R 2.0"
export function levelTagText(kind, f) {
  let t = `${kind.toUpperCase()} ${fmtMoneyTxt(f.money)} (${fmtPipsTxt(f.pips)}) ${fmtPctTxt(f.pct)}`
  if (kind === 'tp' && f.r != null) t += ` R ${Math.abs(f.r).toFixed(1)}`
  return t
}

// ── Drag validation ──────────────────────────────────────────────────────
// `ref` is the price the level is measured from: the entry for a position, the order price
// (limit price for stop-limit) for a pending order. BUY needs SL < ref < TP, SELL the opposite.
export const MIN_DIST_PIPS = 1
export function validateDrag({ kind, side, ref, price, inst, minPips = MIN_DIST_PIPS }) {
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: 'Price must be above 0' }
  const buy = side === 'buy'
  const isSl = kind === 'sl' || kind === 'osl'
  const isTp = kind === 'tp' || kind === 'otp'
  if (!isSl && !isTp) return { ok: true, reason: null }
  const name = isSl ? 'SL' : 'TP'
  const wantBelow = isSl === buy // BUY stop / SELL target sit below the reference
  if (wantBelow ? !(price < ref) : !(price > ref)) return { ok: false, reason: `${name} must be ${wantBelow ? 'below' : 'above'} ${ref.toFixed(inst.digits)}` }
  const distPips = Math.abs(price - ref) / inst.pipSize
  if (distPips < minPips - 1e-9) return { ok: false, reason: `${name} must be at least ${minPips} pip${minPips === 1 ? '' : 's'} from ${ref.toFixed(inst.digits)}` }
  return { ok: true, reason: null }
}

// ── Snapping ─────────────────────────────────────────────────────────────
const tickOf = (inst) => 10 ** -inst.digits
const roundTo = (price, step, digits) => Number((Math.round(price / step) * step).toFixed(digits))
export const roundStepOf = (inst) => inst.pipSize * 10 // "round number": every 10 pips (EURUSD 0.0010, gold 1.00)

// mode: 'off' | 'round' | 'bars'.  Shift = fine (just the tick, no snap), Ctrl = coarse (5× the round step).
// bars: recent [{high, low}] ; a high / low within `barTolPips` pips of the cursor wins.
export function snapPrice(price, { mode = 'off', inst, bars = [], fine = false, coarse = false, barTolPips = 4 }) {
  const d = inst.digits
  if (fine) return roundTo(price, tickOf(inst), d)
  if (coarse) return roundTo(price, roundStepOf(inst) * 5, d)
  if (mode === 'round') return roundTo(price, roundStepOf(inst), d)
  if (mode === 'bars') {
    const tol = barTolPips * inst.pipSize
    let best = null
    for (const b of bars) {
      for (const v of [b.high, b.low]) {
        if (!Number.isFinite(v)) continue
        const dist = Math.abs(v - price)
        if (dist <= tol && (!best || dist < best.dist)) best = { v, dist }
      }
    }
    if (best) return Number(best.v.toFixed(d))
  }
  return roundTo(price, tickOf(inst), d)
}

// Magnetic zone: a stop dragged within `zonePips` of the entry snaps onto it (break-even).
export const BE_ZONE_PIPS = 2
export function breakEvenSnap(price, entry, inst, zonePips = BE_ZONE_PIPS) {
  const near = Math.abs(price - entry) <= zonePips * inst.pipSize + 1e-12
  return near ? { price: entry, snapped: true } : { price, snapped: false }
}

// ── Default SL / TP distances (Settings → Trading) ───────────────────────
// unit: 'pips' | 'percent' | 'atr'. `atr` is in price units (null when not known → no level).
export function defaultLevel({ kind, side, entry, unit, value, inst, atr = null }) {
  if (!(value > 0)) return null
  let dist
  if (unit === 'pips') dist = value * inst.pipSize
  else if (unit === 'percent') dist = (entry * value) / 100
  else if (unit === 'atr') { if (!(atr > 0)) return null; dist = atr * value }
  else return null
  const below = (kind === 'sl') === (side === 'buy')
  const px = Number((below ? entry - dist : entry + dist).toFixed(inst.digits))
  return px > 0 ? px : null
}

export function quickBracket({ side, entry, trading, inst, atr = null }) {
  return {
    sl: defaultLevel({ kind: 'sl', side, entry, unit: trading.defSlUnit, value: trading.defSlValue, inst, atr }),
    tp: defaultLevel({ kind: 'tp', side, entry, unit: trading.defTpUnit, value: trading.defTpValue, inst, atr }),
  }
}

// ── Account strip ────────────────────────────────────────────────────────
// 'none' (no open positions) | 'ok' | 'warn' (< marginWarn) | 'danger' (< stop-out level)
export function marginState(level, warn, stopOut) {
  if (level == null) return 'none'
  if (level < stopOut) return 'danger'
  if (level < warn) return 'warn'
  return 'ok'
}

// ── Undo of chart edits (last modify; Ctrl+Z, or the toast action for 5 s) ─
export const UNDO_TOAST_MS = 5000
export function createUndoStack(limit = 20) {
  const items = []
  return {
    push(entry) { items.push({ ...entry, at: entry.at ?? Date.now() }); if (items.length > limit) items.shift() },
    pop() { return items.pop() || null },
    peek() { return items[items.length - 1] || null },
    clear() { items.length = 0 },
    get size() { return items.length },
    // true while the toast's "Undo" action should still be offered
    fresh(now = Date.now(), ttl = UNDO_TOAST_MS) { const e = items[items.length - 1]; return !!e && now - e.at <= ttl },
  }
}

// What to restore for a modify: the previous value of every key in the patch.
export function inversePatch(prev, patch) {
  const out = {}
  for (const k of Object.keys(patch)) out[k] = prev[k] ?? null
  return out
}

export const LEVEL_LABEL = { sl: 'SL', tp: 'TP', osl: 'SL', otp: 'TP', order: 'Order price', limit: 'Limit price' }
export const movedText = (kind, price, inst) => `${LEVEL_LABEL[kind] || 'Level'} moved to ${price.toLocaleString('en-US', { minimumFractionDigits: inst.digits, maximumFractionDigits: inst.digits })}`

// Execution marker tooltip text (Settings → Show executions). `trade` is a history record, or an open position.
export function execTooltip(kind, t, inst) {
  const px = (n) => n.toLocaleString('en-US', { minimumFractionDigits: inst.digits, maximumFractionDigits: inst.digits })
  const side = t.side.toUpperCase()
  if (kind === 'open') return `${side} ${t.lots} @ ${px(t.entry)}`
  const pl = `${sgn(t.pnl)}$${abs2(t.pnl)}`
  return `Closed ${side} ${t.lots} @ ${px(t.exit)} \u00b7 ${pl}${Number.isFinite(t.pips) ? ` (${sgn(t.pips)}${Math.abs(t.pips).toFixed(1)} pips)` : ''}`
}

// Place mode (+SL / +TP on the pill): the level under the cursor, snapped, with the same validation as a drag.
export function placeCheck({ kind, side, ref, price, inst, snapOpts }) {
  const px = snapPrice(price, { ...snapOpts, inst })
  return { price: px, ...validateDrag({ kind, side, ref, price: px, inst }) }
}

// "Close custom lots": the lots must be on the lot step, at least the minimum, and leave at least the minimum behind.
export function customCloseCheck(lots, held, inst) {
  if (!Number.isFinite(lots) || lots <= 0) return 'Enter the lots to close'
  if (lots >= held - 1e-9) return `Enter less than ${held} lots (use \u2715 to close everything)`
  const steps = lots / inst.lotStep
  if (Math.abs(steps - Math.round(steps)) > 1e-6) return `Lot step is ${inst.lotStep}`
  if (lots < inst.minLot - 1e-9) return `Minimum is ${inst.minLot} lot`
  if (held - lots < inst.minLot - 1e-9) return `Leave at least ${inst.minLot} lot open`
  return null
}
