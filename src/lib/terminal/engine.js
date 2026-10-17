// Pure trading maths for the demo terminal. No React, no state, no I/O —
// everything here is unit-tested in tests/terminal-engine.test.mjs.
import { DEFAULT_RATES, instOf } from './instruments.js'

const round = (n, d) => {
  const f = 10 ** d
  return Math.round((n + Number.EPSILON) * f) / f
}
export const roundMoney = (n) => round(n, 2)

// 1 unit of `quote` currency, expressed in USD (the account currency).
export function quoteToUsd(quote, rates = DEFAULT_RATES) {
  if (quote === 'USD') return 1
  if (quote === 'JPY') return 1 / (rates.USDJPY || DEFAULT_RATES.USDJPY)
  if (quote === 'INR') return 1 / (rates.USDINR || DEFAULT_RATES.USDINR)
  return 1
}

// Bid/ask from a mid price and a total spread (in price units).
export function applySpread(mid, spread, digits) {
  return { bid: round(mid - spread / 2, digits), ask: round(mid + spread / 2, digits) }
}

// Value of ONE pip for ONE lot, in USD.
export function pipValuePerLot(inst, rates) {
  return inst.pipSize * inst.contractSize * quoteToUsd(inst.quote, rates)
}

// Margin (USD) needed to hold `lots` at `price` with `leverage` (e.g. 100 for 1:100).
export function requiredMargin(lots, price, inst, leverage, rates) {
  if (!(leverage > 0)) return Infinity
  return (lots * inst.contractSize * price * quoteToUsd(inst.quote, rates)) / leverage
}

// Profit/loss (USD) for a position. `exit` must already be the CLOSING price:
// BUY closes at the bid, SELL closes at the ask. `entry` is what it filled at.
export function pnl(side, lots, entry, exit, inst, rates) {
  const dir = side === 'buy' ? 1 : -1
  return dir * (exit - entry) * lots * inst.contractSize * quoteToUsd(inst.quote, rates)
}

export const pipsMoved = (side, entry, exit, inst) =>
  ((side === 'buy' ? 1 : -1) * (exit - entry)) / inst.pipSize

// Lot size that risks `riskUsd` if a stop `slPips` away is hit (rounded DOWN to the lot step).
export function lotsFromRisk(riskUsd, slPips, inst, rates) {
  const pv = pipValuePerLot(inst, rates)
  if (!(riskUsd > 0) || !(slPips > 0) || !(pv > 0)) return 0
  const raw = riskUsd / (slPips * pv)
  const steps = Math.floor(raw / inst.lotStep + 1e-9)
  return round(Math.max(0, steps * inst.lotStep), 2)
}

export function validateLots(lots, inst) {
  if (!Number.isFinite(lots) || lots <= 0) return 'Enter a lot size'
  if (lots < inst.minLot - 1e-9) return `Minimum is ${inst.minLot} lot`
  if (lots > inst.maxLot + 1e-9) return `Maximum is ${inst.maxLot} lots`
  const steps = lots / inst.lotStep
  if (Math.abs(steps - Math.round(steps)) > 1e-6) return `Lot step is ${inst.lotStep}`
  return null
}

// Whole-account numbers. `positions`: [{id, symbol, side, lots, entry}]
// `quotes`: { SYMBOL: {bid, ask} }   `instruments`: { SYMBOL: inst }
export function accountMetrics({ balance, positions, quotes, instruments, leverage, rates }) {
  let floating = 0
  let usedMargin = 0
  const perPosition = {}
  for (const p of positions) {
    const inst = instruments[p.symbol] || instOf(p.symbol)
    const q = quotes[p.symbol]
    if (!inst || !q) continue
    const exit = p.side === 'buy' ? q.bid : q.ask
    const pl = pnl(p.side, p.lots, p.entry, exit, inst, rates)
    const m = requiredMargin(p.lots, p.entry, inst, p.leverage || leverage, rates)
    floating += pl
    usedMargin += m
    perPosition[p.id] = { pnl: pl, pips: pipsMoved(p.side, p.entry, exit, inst), margin: m }
  }
  const equity = balance + floating
  return {
    balance,
    floating,
    equity,
    usedMargin,
    freeMargin: equity - usedMargin,
    marginLevel: usedMargin > 0 ? (equity / usedMargin) * 100 : null,
    perPosition,
  }
}

// If margin level is below the stop-out level, return the id of the position to close
// first (the one losing the most); otherwise null.
export function stopOutCandidate(metrics, stopOutLevel = 50) {
  if (metrics.marginLevel == null || metrics.marginLevel >= stopOutLevel) return null
  let worst = null
  for (const [id, v] of Object.entries(metrics.perPosition)) {
    if (!worst || v.pnl < worst.pnl) worst = { id, pnl: v.pnl }
  }
  return worst ? worst.id : null
}

// ── Phase 3: order helpers ───────────────────────────────────────────────

// BUY opens at the ask and closes at the bid; SELL opens at the bid and closes at the ask.
export const entryPrice = (side, q) => (side === 'buy' ? q.ask : q.bid)
export const exitPrice = (side, q) => (side === 'buy' ? q.bid : q.ask)

// Simulated slippage (Settings → "Slippage"): market fills land a little WORSE than the quote,
// never better. `buying` = the fill is a buy (opening a long, or closing a short). The amount is
// uniform in [0, maxPips] pips; `rng` is injectable so tests are deterministic.
export const SLIPPAGE_MAX_PIPS = 0.5
export function applySlippage(buying, price, inst, rng = Math.random, maxPips = SLIPPAGE_MAX_PIPS) {
  const amount = rng() * maxPips * inst.pipSize
  const px = buying ? price + amount : price - amount
  return Number(px.toFixed(inst.digits))
}
// The same idea applied to a whole quote: bid gets lower, ask gets higher (each by its own random
// amount), so whatever side the trade takes it fills worse than the screen price.
export const slipQuote = (q, inst, rng = Math.random) => ({ ...q, bid: applySlippage(false, q.bid, inst, rng), ask: applySlippage(true, q.ask, inst, rng) })

const fmt2 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Stop loss / take profit must sit on the correct side of the price the position closes at.
export function validateStops(side, q, sl, tp, inst) {
  const d = inst.digits
  if (side === 'buy') {
    if (sl != null && !(sl < q.bid)) return `Stop loss must be below ${q.bid.toFixed(d)}`
    if (tp != null && !(tp > q.bid)) return `Take profit must be above ${q.bid.toFixed(d)}`
  } else {
    if (sl != null && !(sl > q.ask)) return `Stop loss must be above ${q.ask.toFixed(d)}`
    if (tp != null && !(tp < q.ask)) return `Take profit must be below ${q.ask.toFixed(d)}`
  }
  return null
}

// Turn a typed SL/TP (as price, pips or $ amount) into a price. Empty -> {price:null}.
export function resolveStop({ mode, value, kind, side, entry, lots, inst, rates }) {
  const raw = String(value ?? '').trim()
  const name = kind === 'sl' ? 'stop loss' : 'take profit'
  if (raw === '') return { price: null }
  const v = Number(raw)
  if (!Number.isFinite(v) || v <= 0) return { error: `Invalid ${name}` }
  let price
  if (mode === 'price') price = v
  else {
    let pips = v
    if (mode === 'usd') {
      if (!(lots > 0)) return { error: 'Enter lots before using a $ amount' }
      pips = v / (pipValuePerLot(inst, rates) * lots)
    }
    const dist = pips * inst.pipSize
    const below = (kind === 'sl') === (side === 'buy') // BUY stop / SELL target sit below entry
    price = below ? entry - dist : entry + dist
  }
  return { price: round(price, inst.digits) }
}

// Can this order be placed? Returns margin/pip value/free-margin-after plus an error (or null).
export function evaluateOrder({ side, lots, quote, inst, leverage, metrics, rates }) {
  const ok = Number.isFinite(lots) && lots > 0
  const price = entryPrice(side, quote)
  const margin = ok ? requiredMargin(lots, price, inst, leverage, rates) : 0
  const pipValue = ok ? pipValuePerLot(inst, rates) * lots : 0
  const freeAfter = metrics.freeMargin - margin
  const base = { margin, pipValue, freeAfter, price }
  const lotErr = validateLots(lots, inst)
  if (lotErr) return { ...base, error: lotErr }
  if (margin > metrics.freeMargin + 1e-9)
    return { ...base, error: `Not enough margin: need $${fmt2(margin)}, free $${fmt2(Math.max(0, metrics.freeMargin))}` }
  return { ...base, error: null }
}

// Realise (part of) a position. pnl is rounded to cents.
export function settleClose(pos, closeLots, exit, inst, rates) {
  const lots = round(closeLots, 4)
  return {
    lots,
    pnl: roundMoney(pnl(pos.side, lots, pos.entry, exit, inst, rates)),
    pips: round(pipsMoved(pos.side, pos.entry, exit, inst), 1),
    remaining: round(pos.lots - lots, 4),
  }
}

// Lots to close for a partial close of `pct` %, on the lot step. {lots} or {error}.
export function splitLots(lots, pct, inst) {
  const steps = Math.floor((lots * pct) / 100 / inst.lotStep + 1e-9)
  const close = round(steps * inst.lotStep, 4)
  if (close < inst.minLot - 1e-9 || lots - close < inst.minLot - 1e-9) return { error: 'Position too small to close that part' }
  return { lots: close }
}

// Did this tick hit the stop loss or take profit? (SL is checked first.) The position then
// closes at the quote itself, i.e. the first price at/beyond the level — so gaps fill worse.
export function checkSlTp(pos, q) {
  const px = exitPrice(pos.side, q)
  if (pos.side === 'buy') {
    if (pos.sl != null && px <= pos.sl) return 'sl'
    if (pos.tp != null && px >= pos.tp) return 'tp'
  } else {
    if (pos.sl != null && px >= pos.sl) return 'sl'
    if (pos.tp != null && px <= pos.tp) return 'tp'
  }
  return null
}

// ── Phase 4: pending orders, trailing, break-even ────────────────────────

export const PENDING_TYPES = ['limit', 'stop', 'stoplimit']
export const ORDER_LABEL = { limit: 'LIMIT', stop: 'STOP', stoplimit: 'STOP-LIMIT' }

// Pending order price rules, checked against the current quote. Returns an error string or null.
//   limit: BUY below ask / SELL above bid      stop: BUY above ask / SELL below bid
//   stop-limit: `price` is the STOP trigger; `limitPrice` is the limit set once triggered
//               (BUY: limit below the stop · SELL: limit above the stop)
export function validatePending({ type, side, price, limitPrice }, q, inst) {
  const d = inst.digits
  const buy = side === 'buy'
  if (!PENDING_TYPES.includes(type)) return 'Unknown order type'
  if (!Number.isFinite(price) || price <= 0) return type === 'stoplimit' ? 'Enter the stop price' : 'Enter a price'
  if (type === 'limit') {
    if (buy && !(price < q.ask)) return `Buy limit must be below ${q.ask.toFixed(d)}`
    if (!buy && !(price > q.bid)) return `Sell limit must be above ${q.bid.toFixed(d)}`
  } else {
    if (buy && !(price > q.ask)) return `Buy ${type === 'stop' ? 'stop' : 'stop price'} must be above ${q.ask.toFixed(d)}`
    if (!buy && !(price < q.bid)) return `Sell ${type === 'stop' ? 'stop' : 'stop price'} must be below ${q.bid.toFixed(d)}`
  }
  if (type === 'stoplimit') {
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) return 'Enter the limit price'
    if (buy && !(limitPrice < price)) return `Buy limit price must be below the stop ${price.toFixed(d)}`
    if (!buy && !(limitPrice > price)) return `Sell limit price must be above the stop ${price.toFixed(d)}`
  }
  return null
}

// SL/TP validated against a fixed entry price (used for pending orders).
export function validateStopsAt(side, entry, sl, tp, inst) {
  const d = inst.digits
  if (side === 'buy') {
    if (sl != null && !(sl < entry)) return `Stop loss must be below ${entry.toFixed(d)}`
    if (tp != null && !(tp > entry)) return `Take profit must be above ${entry.toFixed(d)}`
  } else {
    if (sl != null && !(sl > entry)) return `Stop loss must be above ${entry.toFixed(d)}`
    if (tp != null && !(tp < entry)) return `Take profit must be below ${entry.toFixed(d)}`
  }
  return null
}

// Where a pending order fills if price moves continuously through it.
export const orderFillLevel = (o) => (o.type === 'stoplimit' ? o.limitPrice : o.price)

// 'fill' | 'trigger' (stop-limit stage 1) | null for this quote.
export function checkOrder(o, q) {
  const buy = o.side === 'buy'
  if (o.type === 'limit') return (buy ? q.ask <= o.price : q.bid >= o.price) ? 'fill' : null
  if (o.type === 'stop') return (buy ? q.ask >= o.price : q.bid <= o.price) ? 'fill' : null
  if (!o.triggered) return (buy ? q.ask >= o.price : q.bid <= o.price) ? 'trigger' : null
  return (buy ? q.ask <= o.limitPrice : q.bid >= o.limitPrice) ? 'fill' : null
}

// Price that is `pips` in profit from entry.
export const priceAtPips = (side, entry, pips, inst) =>
  round(entry + (side === 'buy' ? 1 : -1) * pips * inst.pipSize, inst.digits)

// Trailing stop (fixed pips): the new SL, or null. It only starts once price is beyond entry
// by the trail distance, only ever tightens, and moves in 1-pip steps.
export function trailTarget(pos, q, inst) {
  if (!pos.trail) return null
  const step = inst.pipSize
  if (pos.side === 'buy') {
    const cand = round(q.bid - pos.trail * inst.pipSize, inst.digits)
    if (cand <= pos.entry) return null
    if (pos.sl != null && cand < pos.sl + step - 1e-9) return null
    return cand
  }
  const cand = round(q.ask + pos.trail * inst.pipSize, inst.digits)
  if (cand >= pos.entry) return null
  if (pos.sl != null && cand > pos.sl - step + 1e-9) return null
  return cand
}
