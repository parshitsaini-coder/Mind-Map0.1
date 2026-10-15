// Phase 13 — turns a bus event into what the "Done" popup shows. Pure.
import { EVENTS_BY_ID } from './eventCatalog.js'
import { INSTRUMENTS } from './instruments.js'

// every catalogue event maps to a variant ('none' = no popup: the toast / chart effect covers it)
export const POPUP_VARIANT = {
  'order.buy.filled': 'filled',
  'order.sell.filled': 'filled',
  'order.pending.placed': 'pending',
  'order.pending.triggered': 'triggered',
  'order.modified': 'modified',
  'order.cancelled': 'cancelled',
  'order.rejected': 'rejected',
  'position.closed.win': 'closed',
  'position.closed.loss': 'closed',
  'position.closed.flat': 'closed',
  'position.partial': 'closed',
  'position.sl.hit': 'hit',
  'position.tp.hit': 'hit',
  'position.reversed': 'reversed',
  'account.margin.warning': 'none',
  'account.stopout': 'hit',
  'alert.price': 'none',
  'connection.lost': 'none',
  'connection.restored': 'none',
  'ui.click': 'none',
  'ui.toggle': 'none',
}

export const money = (n) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`
const SIDE = (s) => String(s || '').toUpperCase()
export function fmtPrice(symbol, p) {
  if (p == null || !Number.isFinite(p)) return '—'
  const d = INSTRUMENTS[symbol]?.digits ?? 5
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
export function slipText(pips) {
  if (!Number.isFinite(pips) || Math.abs(pips) < 0.05) return null
  const a = Math.abs(pips)
  return `filled ${a.toFixed(1)} pip${a > 1 ? 's' : ''} ${pips > 0 ? 'worse' : 'better'}`
}
const ORDER_NAME = { limit: 'LIMIT', stop: 'STOP', stoplimit: 'STOP-LIMIT', market: 'MARKET' }

// P/L count-up: 0 → `to`, eased; t >= 1 returns EXACTLY `to` (no rounding drift).
export function countUp(to, t) {
  if (!(t < 1)) return to
  if (!(t > 0)) return 0
  const e = 1 - Math.pow(1 - t, 3)
  return Math.round(to * e * 100) / 100
}
// Roll a price from `from` to `to` (modify popup); same exact-end rule.
export const rollTo = (from, to, t) => (t >= 1 ? to : t <= 0 ? from : from + (to - from) * (1 - Math.pow(1 - t, 3)))

// evt = { id, text, kind, data }. Returns null when the event has no popup.
export function popupFor(evt) {
  const def = EVENTS_BY_ID[evt?.id]
  if (!def) return null
  const variant = POPUP_VARIANT[def.id] || 'none'
  if (variant === 'none') return null
  const d = evt.data || {}
  const sym = d.symbol
  const base = { id: def.id, variant, symbol: sym || null, shake: false, count: null, roll: null, lines: [], tone: 'info', icon: 'check' }
  switch (variant) {
    case 'filled': {
      const side = def.id === 'order.sell.filled' ? 'sell' : 'buy'
      const lines = [`${sym || ''} · ${d.lots ?? ''} lots`.trim(), `@ ${fmtPrice(sym, d.price)}`]
      if (d.sl != null || d.tp != null) lines.push(`SL ${d.sl != null ? fmtPrice(sym, d.sl) : '—'} · TP ${d.tp != null ? fmtPrice(sym, d.tp) : '—'}`)
      const sl = slipText(d.slipPips)
      if (sl) lines.push(sl)
      return { ...base, tone: side, icon: 'check', title: `${SIDE(side)} FILLED`, lines, priceRoll: { symbol: sym, to: d.price } }
    }
    case 'pending': {
      const t = ORDER_NAME[d.orderType] || ''
      return { ...base, tone: d.side === 'sell' ? 'sell' : 'buy', icon: 'target', title: `${SIDE(d.side)} ${t} PLACED @ ${fmtPrice(sym, d.price)}`.replace('  ', ' '), lines: [`${sym || ''} · ${d.lots ?? ''} lots`.trim()], ring: Number.isFinite(d.distPips) ? { pips: d.distPips } : null }
    }
    case 'triggered':
      return { ...base, tone: d.side === 'sell' ? 'sell' : 'buy', icon: 'bolt', title: d.orderType === 'stop' || d.orderType === 'stoplimit' ? 'STOP TRIGGERED' : 'LIMIT FILLED', lines: [`${sym || ''} · ${d.lots ?? ''} lots`.trim(), ...(d.price != null ? [`@ ${fmtPrice(sym, d.price)}`] : [])] }
    case 'modified': {
      const what = d.what || 'ORDER'
      return { ...base, tone: 'info', icon: 'pencil', title: `${what} MOVED`, lines: [d.from != null && d.to != null ? `${fmtPrice(sym, d.from)} → ${fmtPrice(sym, d.to)}` : (evt.text || '')], roll: d.from != null && d.to != null ? { symbol: sym, from: d.from, to: d.to } : null }
    }
    case 'cancelled':
      return { ...base, tone: 'neutral', icon: 'x', title: 'ORDER CANCELLED', lines: [evt.text || ''] }
    case 'rejected':
      return { ...base, tone: 'error', icon: 'alert', title: 'ORDER REJECTED', lines: [d.reason || evt.text || ''], shake: true, fix: d.fixable ? { label: 'Fix' } : null }
    case 'closed': {
      const pnl = Number.isFinite(d.pnl) ? d.pnl : 0
      const partial = def.id === 'position.partial'
      const title = partial ? 'PARTIAL CLOSE' : pnl > 0 ? 'CLOSED IN PROFIT' : pnl < 0 ? 'CLOSED AT A LOSS' : 'CLOSED FLAT'
      return { ...base, tone: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'neutral', icon: pnl > 0 ? 'check' : pnl < 0 ? 'down' : 'dash', title, lines: [`${SIDE(d.side)} ${sym || ''} ${d.lots ?? ''}`.trim()], count: { to: pnl }, sparkle: pnl > 0 }
    }
    case 'hit': {
      const pnl = Number.isFinite(d.pnl) ? d.pnl : null
      if (def.id === 'account.stopout') return { ...base, tone: 'error', icon: 'alert', title: 'STOP-OUT', lines: [d.marginLevel != null ? `margin level ${Math.round(d.marginLevel)} %` : (evt.text || '')], count: pnl != null ? { to: pnl } : null, banner: true }
      const tp = def.id === 'position.tp.hit'
      return { ...base, tone: tp ? 'win' : 'loss', icon: tp ? 'target' : 'down', title: tp ? 'TARGET HIT' : 'STOPPED OUT', lines: [`${SIDE(d.side)} ${sym || ''} ${d.lots ?? ''}`.trim()], count: pnl != null ? { to: pnl } : null, sparkle: tp }
    }
    case 'reversed':
      return { ...base, tone: d.side === 'sell' ? 'sell' : 'buy', icon: 'flip', title: `REVERSED → ${SIDE(d.side)}`, lines: [`${sym || ''} · ${d.lots ?? ''} lots`.trim()] }
    default:
      return null
  }
}
