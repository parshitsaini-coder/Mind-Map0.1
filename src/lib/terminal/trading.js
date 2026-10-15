// Order / position rules for the demo terminal — pure functions (no React, no
// store). The store calls these; tests/terminal-trading.test.mjs checks them.
import { INSTRUMENTS } from './instruments.js'
import { evalExit, windowFromQuote } from './orders.js'
import { accountMetrics, pipsMoved, pnl, requiredMargin, roundMoney, validateLots } from './engine.js'

const roundTo = (n, d) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d

// Price that is `pips` away from `entry` on the protective side.
//   kind 'sl' -> against the trade, 'tp' -> in favour of the trade.
export function priceFromPips(side, entry, pips, kind, inst) {
  const dir = side === 'buy' ? 1 : -1
  const sign = kind === 'tp' ? 1 : -1
  return roundTo(entry + dir * sign * pips * inst.pipSize, inst.digits)
}

// BUY fills at the ask, SELL at the bid.
export const fillPrice = (side, quote) => (side === 'buy' ? quote.ask : quote.bid)

// Returns an error string, or null when the order is acceptable.
export function validateOrder({ side, lots, sl = null, tp = null, inst, quote, balance, positions, quotes, instruments = INSTRUMENTS, leverage, rates }) {
  if (!inst || !quote) return 'No price yet — wait a moment'
  const lotErr = validateLots(lots, inst)
  if (lotErr) return lotErr
  const entry = fillPrice(side, quote)
  if (sl != null) {
    if (side === 'buy' && sl >= entry) return 'Stop loss must be below the buy price'
    if (side === 'sell' && sl <= entry) return 'Stop loss must be above the sell price'
  }
  if (tp != null) {
    if (side === 'buy' && tp <= entry) return 'Take profit must be above the buy price'
    if (side === 'sell' && tp >= entry) return 'Take profit must be below the sell price'
  }
  const need = requiredMargin(lots, entry, inst, leverage, rates)
  const m = accountMetrics({ balance, positions, quotes, instruments, leverage, rates })
  if (need > m.freeMargin + 1e-9) {
    return `Not enough margin — needs $${need.toFixed(2)}, free $${Math.max(0, m.freeMargin).toFixed(2)}`
  }
  return null
}

// Has this position's SL or TP been touched by `quote`? (live tick: fills AT the level)
export function checkTriggers(pos, quote) {
  return quote ? evalExit(pos, windowFromQuote(quote)) : null
}

// Close all or part of a position at `price`. Returns the closed-trade record
// and what is left of the position (null when fully closed).
export function closePortion(pos, lots, price, inst, rates, reason, time = Date.now()) {
  const closeLots = Math.min(lots ?? pos.lots, pos.lots)
  const full = closeLots >= pos.lots - 1e-9
  const lotsClosed = full ? pos.lots : roundTo(closeLots, 2)
  const trade = {
    id: `${pos.id}${full ? '' : `-${time}`}`,
    symbol: pos.symbol,
    side: pos.side,
    lots: lotsClosed,
    entry: pos.entry,
    exit: price,
    pnl: roundMoney(pnl(pos.side, lotsClosed, pos.entry, price, inst, rates)),
    pips: roundTo(pipsMoved(pos.side, pos.entry, price, inst), 1),
    openTime: pos.openTime,
    closeTime: time,
    tf: pos.tf ?? null,
    reason,
  }
  const remaining = full ? null : { ...pos, lots: roundTo(pos.lots - lotsClosed, 2) }
  return { trade, remaining }
}
