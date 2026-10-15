// Builds the `data` payload that rides on a terminal event (Phase 13). Pure. Popups, chart effects and toasts read it.
// All prices are plain numbers; `digits` tells the UI how to print them.
const r1 = (n) => Math.round(n * 10) / 10

// How much worse (+) or better (-) than the quote a market order filled, in pips (0.1 resolution).
export function slipPips(side, entry, quote, pipSize) {
  if (!quote || !(pipSize > 0) || !Number.isFinite(entry)) return 0
  const d = side === 'buy' ? entry - quote.ask : quote.bid - entry
  const v = r1(d / pipSize)
  return v === 0 ? 0 : v
}

export function positionData(p, inst, extra = {}) {
  return { symbol: p.symbol, side: p.side, lots: p.lots, price: p.entry, sl: p.sl ?? null, tp: p.tp ?? null, digits: inst?.digits ?? 5, ticket: p.id, ...extra }
}
export function orderData(o, inst, extra = {}) {
  return { symbol: o.symbol, side: o.side, lots: o.lots, price: o.price, orderType: o.type, sl: o.sl ?? null, tp: o.tp ?? null, digits: inst?.digits ?? 5, ticket: o.id, ...extra }
}
export function tradeData(t, inst, extra = {}) {
  return { symbol: t.symbol, side: t.side, lots: t.lots, price: t.exit, entry: t.entry, pnl: t.pnl, pips: t.pips, reason: t.reason, sl: t.sl ?? null, tp: t.tp ?? null, digits: inst?.digits ?? 5, ticket: t.positionId || t.id, ...extra }
}

// Which field a modify patch changed, with before / after values.  Returns null when nothing visible changed.
export function modifyData(prev, patch, inst, extra = {}) {
  if (!prev || !patch) return null
  for (const f of ['sl', 'tp', 'price']) {
    if (f in patch && patch[f] !== prev[f]) return { symbol: prev.symbol, side: prev.side, field: f, from: prev[f] ?? null, to: patch[f] ?? null, digits: inst?.digits ?? 5, ...extra }
  }
  return null
}

// A new best trade: positive and strictly above every earlier closed trade (needs at least one earlier trade).
export function isBestTrade(pnl, history) {
  if (!(pnl > 0) || !history || !history.length) return false
  let best = -Infinity
  for (const h of history) if (h.pnl > best) best = h.pnl
  return pnl > best
}

// A ledger event (processTick / catchUp) -> data payload.  instOf(symbol) returns the instrument spec.
export function ledgerData(e, instOf, stopOutLevel) {
  if (!e) return null
  switch (e.type) {
    case 'fill': return positionData(e.position, instOf(e.position.symbol), { orderType: e.order.type })
    case 'trigger': return orderData(e.order, instOf(e.order.symbol))
    case 'sl': case 'tp': case 'ptp': return tradeData(e.trade, instOf(e.trade.symbol))
    case 'stopout': return tradeData(e.trade, instOf(e.trade.symbol), { level: stopOutLevel })
    case 'be': return { symbol: e.position.symbol, side: e.position.side, field: 'sl', from: null, to: e.position.entry, digits: instOf(e.position.symbol)?.digits ?? 5 }
    case 'expired': case 'oco': return orderData(e.order, instOf(e.order.symbol))
    case 'rejected': return orderData(e.order, instOf(e.order.symbol), { reason: e.error })
    default: return null
  }
}
