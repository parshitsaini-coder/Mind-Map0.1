import { useTerminalStore } from '../../store/terminalStore'
import { INSTRUMENTS } from '../../lib/terminal/instruments'
import { getSnapshot } from '../../lib/terminal/quoteHub'
import { EVENT_BY_ID } from '../../lib/terminal/eventCatalog'
import { emitTerminalEvent } from '../../lib/terminal/effects'

// A realistic sample event for any catalogue id, around the current price of the open symbol. Used by the effects
// playground and by the "Try it" buttons in Settings → Animations, so what you see there is what a real fill looks like.
const KIND = { win: ['position.closed.win', 'position.tp.hit', 'connection.restored'], loss: ['position.closed.loss', 'position.sl.hit', 'account.stopout'], error: ['order.rejected', 'account.margin.warning'] }

export function sampleEvent(id) {
  const st = useTerminalStore.getState()
  const sym = st.symbol
  const inst = INSTRUMENTS[sym] || INSTRUMENTS.XAUUSD
  const q = getSnapshot()[sym]
  const r = (n) => Number(n.toFixed(inst.digits))
  const px = r(q ? q.bid : inst.base)
  const up = (pips) => r(px + pips * inst.pipSize)
  const base = { symbol: sym, digits: inst.digits, lots: 0.5, side: 'buy', price: px }
  const D = {
    'order.buy.filled': { sl: up(-20), tp: up(40), slip: 0.4 },
    'order.sell.filled': { side: 'sell', sl: up(20), tp: up(-40), slip: 1.5 },
    'order.pending.placed': { orderType: 'limit', price: up(-15), distPips: 15 },
    'order.pending.triggered': { orderType: 'limit' },
    'order.modified': { field: 'sl', from: up(-20), to: up(-8), price: up(-8) },
    'order.cancelled': { orderType: 'limit', price: up(-15) },
    'order.rejected': { reason: 'Not enough free margin for this size', price: null },
    'position.closed.win': { pnl: 90, pips: 30, best: true },
    'position.closed.loss': { pnl: -45, pips: -15 },
    'position.closed.flat': { pnl: 0, pips: 0 },
    'position.partial': { pnl: 22.5, pips: 10 },
    'position.sl.hit': { price: up(-20), pnl: -45, pips: -20 },
    'position.tp.hit': { price: up(30), pnl: 90, pips: 30 },
    'position.reversed': { side: 'sell' },
    'account.margin.warning': { level: 82, price: null },
    'account.stopout': { side: 'buy', pnl: -310, level: st.settings.stopOutLevel },
    'alert.price': {},
    'connection.lost': { price: null }, 'connection.restored': { price: null },
  }
  const def = EVENT_BY_ID[id]
  const kind = Object.keys(KIND).find((k) => KIND[k].includes(id)) || 'info'
  return { id, text: def ? def.text : id, kind, data: { ...base, ...(D[id] || {}) } }
}

// Test hook (only when localStorage 'terminal-debug' is set): window.__terminalEmit('position.tp.hit') fires a sample event.
try { if (typeof window !== 'undefined' && localStorage.getItem('terminal-debug')) window.__terminalEmit = (id) => emitTerminalEvent(sampleEvent(id)) } catch { /* ignore */ }
