// Offline catch-up: replay what the market did while the terminal was closed
// (M1 candles) against open positions and pending orders, in time order.
// APPROXIMATE by design: candles have no tick order, so SL is assumed to be hit
// before TP inside one candle, an order that fills in a candle is only managed
// from the NEXT candle, and trailing / break-even / partial-TP do not run.
import { evalExit, evalPending, openFromPending } from './orders.js'
import { closePortion } from './trading.js'
import { requiredMargin } from './engine.js'

// windows: [{ symbol, time (sec), win }] — will be processed sorted by time.
export function replayMissed({ positions, pendings, balance, leverage, rates, windows, instruments, newId }) {
  let pos = [...positions]
  let pend = [...pendings]
  let bal = balance
  const trades = []
  const events = []

  const usedMargin = () =>
    pos.reduce((sum, p) => sum + requiredMargin(p.lots, p.entry, instruments[p.symbol], leverage, rates), 0)

  for (const { symbol, time, win } of [...windows].sort((a, b) => a.time - b.time)) {
    const inst = instruments[symbol]
    const tMs = time * 1000
    const existing = new Set(pos.map((p) => p.id)) // positions opened in THIS window wait for the next one

    // 1) exits of positions that were already open
    for (const p of pos.filter((x) => x.symbol === symbol && existing.has(x.id))) {
      const hit = evalExit(p, win)
      if (!hit) continue
      const { trade } = closePortion(p, undefined, hit.price, inst, rates, hit.reason, tMs)
      bal = Math.round((bal + trade.pnl) * 100) / 100
      pos = pos.filter((x) => x.id !== p.id)
      trades.push(trade)
      events.push({ type: 'close', trade })
    }

    // 2) pending orders
    for (const o of pend.filter((x) => x.symbol === symbol)) {
      if (!pend.some((x) => x.id === o.id)) continue // cancelled by an OCO sibling this window
      const r = evalPending(o, win, tMs)
      if (!r) continue
      if (r.action === 'expire') {
        pend = pend.filter((x) => x.id !== o.id)
        events.push({ type: 'expire', order: o })
      } else if (r.action === 'trigger') {
        pend = pend.map((x) => (x.id === o.id ? { ...x, triggered: true } : x))
      } else if (r.action === 'fill') {
        pend = pend.filter((x) => x.id !== o.id)
        const need = requiredMargin(o.lots, r.price, inst, leverage, rates)
        if (bal - usedMargin() < need) {
          events.push({ type: 'cancel', order: o, why: 'not enough margin' })
          continue
        }
        pos = [...pos, openFromPending(o, r.price, tMs, newId())]
        events.push({ type: 'fill', order: o, price: r.price })
        if (o.oco) {
          const sibs = pend.filter((x) => x.oco === o.oco)
          pend = pend.filter((x) => x.oco !== o.oco)
          sibs.forEach((s) => events.push({ type: 'cancel', order: s, why: 'OCO' }))
        }
      }
    }
  }
  return { positions: pos, pendings: pend, balance: bal, trades, events }
}
