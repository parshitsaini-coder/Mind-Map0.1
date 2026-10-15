// Pending orders, SL/TP evaluation, trailing / break-even / partial TP and
// position-modify rules — pure functions shared by the live engine (price
// ticks) and the offline catch-up replay (M1 candles).
//
// A "window" describes what prices did during a slice of time:
//   { bidOpen, bidHigh, bidLow, askOpen, askHigh, askLow, hasOpen }
// For a live tick all six are the current quote and hasOpen=false (so fills
// happen AT the level). For a candle hasOpen=true, which turns on gap handling:
// if the candle OPENED already beyond a level, the fill is at the open.
import { validateLots } from './engine.js'

const roundTo = (n, d) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d

export const windowFromQuote = (q) => ({
  bidOpen: q.bid, bidHigh: q.bid, bidLow: q.bid,
  askOpen: q.ask, askHigh: q.ask, askLow: q.ask,
  hasOpen: false,
})

// Candles are mid prices; bid/ask are mid -/+ half the spread.
export function windowFromCandle(c, spread) {
  const h = spread / 2
  return {
    bidOpen: c.open - h, bidHigh: c.high - h, bidLow: c.low - h,
    askOpen: c.open + h, askHigh: c.high + h, askLow: c.low + h,
    hasOpen: true,
  }
}

// SL / TP of an open position. SL is checked first when both are inside one window.
export function evalExit(pos, w) {
  if (pos.side === 'buy') {
    if (pos.sl != null && w.bidLow <= pos.sl) return { reason: 'sl', price: w.hasOpen && w.bidOpen <= pos.sl ? w.bidOpen : pos.sl }
    if (pos.tp != null && w.bidHigh >= pos.tp) return { reason: 'tp', price: w.hasOpen && w.bidOpen >= pos.tp ? w.bidOpen : pos.tp }
  } else {
    if (pos.sl != null && w.askHigh >= pos.sl) return { reason: 'sl', price: w.hasOpen && w.askOpen >= pos.sl ? w.askOpen : pos.sl }
    if (pos.tp != null && w.askLow <= pos.tp) return { reason: 'tp', price: w.hasOpen && w.askOpen <= pos.tp ? w.askOpen : pos.tp }
  }
  return null
}

// What should happen to a pending order in this window?
//   null | {action:'expire'} | {action:'trigger'} (stop-limit stage 1) | {action:'fill', price}
export function evalPending(order, w, now) {
  if (order.expiry != null && now >= order.expiry) return { action: 'expire' }
  const buy = order.side === 'buy'
  if (order.type === 'stoplimit' && !order.triggered) {
    return (buy ? w.askHigh >= order.trigger : w.bidLow <= order.trigger) ? { action: 'trigger' } : null
  }
  const isLimit = order.type === 'limit' || order.type === 'stoplimit'
  const p = order.price
  if (buy) {
    if (isLimit && w.askLow <= p) return { action: 'fill', price: w.hasOpen && w.askOpen <= p ? w.askOpen : p }
    if (!isLimit && w.askHigh >= p) return { action: 'fill', price: w.hasOpen && w.askOpen >= p ? w.askOpen : p }
  } else {
    if (isLimit && w.bidHigh >= p) return { action: 'fill', price: w.hasOpen && w.bidOpen >= p ? w.bidOpen : p }
    if (!isLimit && w.bidLow <= p) return { action: 'fill', price: w.hasOpen && w.bidOpen <= p ? w.bidOpen : p }
  }
  return null
}

// Error string or null. SL/TP are measured from the order price (the limit
// price for stop-limit orders).
export function validatePending({ type, side, lots, price, trigger = null, sl = null, tp = null, expiry = null, inst, quote, now = Date.now() }) {
  if (!inst || !quote) return 'No price yet — wait a moment'
  const lotErr = validateLots(lots, inst)
  if (lotErr) return lotErr
  if (!Number.isFinite(price)) return 'Enter an order price'
  const buy = side === 'buy'
  if (type === 'limit') {
    if (buy && price >= quote.ask) return 'Buy limit price must be below the current ask'
    if (!buy && price <= quote.bid) return 'Sell limit price must be above the current bid'
  } else if (type === 'stop') {
    if (buy && price <= quote.ask) return 'Buy stop price must be above the current ask'
    if (!buy && price >= quote.bid) return 'Sell stop price must be below the current bid'
  } else if (type === 'stoplimit') {
    if (!Number.isFinite(trigger)) return 'Enter the stop (trigger) price'
    if (buy && trigger <= quote.ask) return 'Buy stop-limit trigger must be above the current ask'
    if (!buy && trigger >= quote.bid) return 'Sell stop-limit trigger must be below the current bid'
    if (buy && price >= trigger) return 'Buy stop-limit: limit price must be below the trigger'
    if (!buy && price <= trigger) return 'Sell stop-limit: limit price must be above the trigger'
  } else return 'Unknown order type'
  if (sl != null && (buy ? sl >= price : sl <= price)) return buy ? 'Stop loss must be below the order price' : 'Stop loss must be above the order price'
  if (tp != null && (buy ? tp <= price : tp >= price)) return buy ? 'Take profit must be above the order price' : 'Take profit must be below the order price'
  if (expiry != null && expiry <= now) return 'Expiry must be in the future'
  return null
}

export function openFromPending(order, price, now, id) {
  return { id, symbol: order.symbol, side: order.side, lots: order.lots, entry: price, sl: order.sl ?? null, tp: order.tp ?? null, openTime: now, trail: null, beAt: null, partial: null }
}

// Validate edits to an open position against the CURRENT price. patch keys:
// sl, tp (price|null), trail, beAt (pips|null), partial ({pips, pct}|null)
export function validateModify(pos, patch, quote, inst) {
  if (!quote) return 'No price yet — wait a moment'
  const buy = pos.side === 'buy'
  const ref = buy ? quote.bid : quote.ask
  const sl = 'sl' in patch ? patch.sl : pos.sl
  const tp = 'tp' in patch ? patch.tp : pos.tp
  if (sl != null && (buy ? sl >= ref : sl <= ref)) return buy ? 'Stop loss must be below the current price' : 'Stop loss must be above the current price'
  if (tp != null && (buy ? tp <= ref : tp >= ref)) return buy ? 'Take profit must be above the current price' : 'Take profit must be below the current price'
  if (patch.trail != null && !(patch.trail > 0)) return 'Trailing distance must be more than 0 pips'
  if (patch.beAt != null && !(patch.beAt > 0)) return 'Break-even trigger must be more than 0 pips'
  if (patch.partial != null) {
    if (!(patch.partial.pips > 0)) return 'Partial TP distance must be more than 0 pips'
    if (!(patch.partial.pct >= 1 && patch.partial.pct <= 99)) return 'Partial close must be 1–99%'
  }
  void inst
  return null
}

// Per-tick position management (trailing stop, auto break-even, partial TP).
// Returns { sl?, closeLots?, partialDone? } — empty when nothing to do.
export function managePosition(pos, quote, inst) {
  const out = {}
  if (!quote) return out
  const buy = pos.side === 'buy'
  const ref = buy ? quote.bid : quote.ask
  const profitPips = ((buy ? 1 : -1) * (ref - pos.entry)) / inst.pipSize
  let sl = pos.sl

  if (pos.beAt > 0 && profitPips >= pos.beAt && (sl == null || (buy ? sl < pos.entry : sl > pos.entry))) {
    sl = pos.entry
    out.sl = sl
  }
  if (pos.trail > 0 && profitPips >= pos.trail) {
    const dist = pos.trail * inst.pipSize
    const cand = roundTo(buy ? quote.bid - dist : quote.ask + dist, inst.digits)
    if (sl == null || (buy ? cand > sl : cand < sl)) out.sl = cand
  }
  if (pos.partial && !pos.partial.done && profitPips >= pos.partial.pips) {
    const raw = (pos.lots * pos.partial.pct) / 100
    const lots = roundTo(Math.floor(raw / inst.lotStep + 1e-9) * inst.lotStep, 2)
    out.partialDone = true
    if (lots >= inst.minLot - 1e-9 && lots < pos.lots - 1e-9) out.closeLots = lots
  }
  return out
}
