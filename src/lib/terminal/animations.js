// Phase 13, pure logic: which popup / chart effect an event gets, reduced-motion variants, the count-up curve,
// the effect queue (cap), the frame-time governor, the margin watcher. No DOM, no React.
import { EVENT_BY_ID } from './eventCatalog.js'

// ── mode ────────────────────────────────────────────────────────────────
// 'full' | 'reduced' | 'off'. Reduced = 120 ms fades, no particles / shake / vignette.
export function effectiveMode(anim, { systemReduced = false, adaptive = false } = {}) {
  if (!anim || anim.mode === 'off') return 'off'
  if (adaptive || anim.mode === 'reduced' || (anim.matchSystem && systemReduced)) return 'reduced'
  return 'full'
}

// ── text helpers ────────────────────────────────────────────────────────
export const signedMoney = (n) => `${n < 0 ? '−' : '+'}$${Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const TYPE_WORD = { market: 'MARKET', limit: 'LIMIT', stop: 'STOP', stoplimit: 'STOP-LIMIT' }
const upper = (s) => String(s || '').toUpperCase()
const priceTxt = (p) => (Number.isFinite(p) ? String(p) : '')
const sym = (d) => [d.symbol, d.lots != null ? `${d.lots} lots` : null].filter(Boolean).join(' · ')

// Rounds a count-up to cents so the last frame equals the final value exactly.
export function countUp(to, t) {
  const final = Math.round((Number(to) || 0) * 100) / 100
  if (!(t < 1)) return final
  if (!(t > 0)) return 0
  const e = 1 - Math.pow(1 - t, 3)
  return Math.round(final * e * 100) / 100
}

// ── popup ("Done" card) ─────────────────────────────────────────────────
// Returns null (no card) or { id, variant, tone, icon, title, lines, count, motion, ms }.
//   tone  buy | sell | win | loss | neutral | warn | error | urgent
//   motion  draw (check draws itself) | shake | fade | pop | none
//   count  { to } : the headline P/L counts up from 0 to `to` (full mode only; reduced shows the final value)
export function popupSpec(evt, mode, anim) {
  if (!evt || mode === 'off' || !anim || anim.popup !== 'full') return null
  const d = evt.data || {}
  const reduced = mode === 'reduced'
  const ms = reduced ? 1200 : Math.round((anim.popupSeconds || 1.6) * 1000)
  const sl = Number.isFinite(d.sl) ? `SL ${d.sl}` : null
  const tp = Number.isFinite(d.tp) ? `TP ${d.tp}` : null
  const stops = [sl, tp].filter(Boolean).join(' · ')
  const mk = (variant, tone, icon, title, lines, motion, count = null) => ({
    id: evt.id, variant, tone, icon, title, lines: lines.filter(Boolean), motion: reduced ? 'fade' : motion,
    count: reduced ? null : count, finalText: count ? signedMoney(count.to) : null, ms,
  })
  switch (evt.id) {
    case 'order.buy.filled': return mk('filled-buy', 'buy', 'check', 'BUY FILLED', [sym(d), d.price != null ? `@ ${priceTxt(d.price)}` : null, stops, d.slippage ? `filled ${d.slippage} worse` : null], 'draw')
    case 'order.sell.filled': return mk('filled-sell', 'sell', 'check', 'SELL FILLED', [sym(d), d.price != null ? `@ ${priceTxt(d.price)}` : null, stops, d.slippage ? `filled ${d.slippage} worse` : null], 'draw')
    case 'order.pending.placed': return mk('pending', 'neutral', 'clock', `${upper(d.side)} ${TYPE_WORD[d.orderType] || upper(d.orderType)} PLACED`.replace(/\s+/g, ' ').trim(), [sym(d), d.price != null ? `@ ${priceTxt(d.price)}` : null, stops], 'pop')
    case 'order.pending.triggered': return mk('triggered', d.side === 'sell' ? 'sell' : 'buy', 'check', d.orderType === 'stop' || d.orderType === 'stoplimit' ? 'STOP TRIGGERED' : 'LIMIT FILLED', [sym(d), d.price != null ? `@ ${priceTxt(d.price)}` : null], 'draw')
    case 'order.modified': return mk('modified', 'neutral', 'pencil', 'ORDER MODIFIED', [d.text || evt.text], 'pop')
    case 'order.cancelled': return mk('cancelled', 'neutral', 'cross', 'ORDER CANCELLED', [sym(d) || evt.text], 'fade')
    case 'order.rejected': return mk('rejected', 'error', 'alert', 'ORDER REJECTED', [d.reason || evt.text || 'The order was not accepted'], 'shake')
    case 'position.closed.win': return mk('closed-win', 'win', 'check', 'POSITION CLOSED', [sym(d)], 'draw', { to: d.pnl || 0 })
    case 'position.closed.loss': return mk('closed-loss', 'loss', 'cross', 'POSITION CLOSED', [sym(d)], 'fade', { to: d.pnl || 0 })
    case 'position.closed.flat': return mk('closed-flat', 'neutral', 'check', 'CLOSED FLAT', [sym(d)], 'fade', { to: 0 })
    case 'position.partial': return mk('partial', (d.pnl || 0) >= 0 ? 'win' : 'loss', 'check', 'PARTIAL CLOSE', [sym(d)], 'pop', { to: d.pnl || 0 })
    case 'position.tp.hit': return mk('tp', 'win', 'check', 'TARGET HIT', [sym(d)], 'draw', { to: d.pnl || 0 })
    case 'position.sl.hit': return mk('sl', 'loss', 'cross', 'STOPPED OUT', [sym(d)], 'shake', { to: d.pnl || 0 })
    case 'position.reversed': return mk('reversed', d.side === 'sell' ? 'sell' : 'buy', 'flip', 'POSITION REVERSED', [`${upper(d.side)} ${sym(d)}`.trim()], 'pop')
    case 'account.margin.warning': return mk('margin', 'warn', 'alert', 'MARGIN WARNING', [d.level != null ? `margin level ${Math.round(d.level)} %` : evt.text], 'pop')
    case 'account.stopout': return mk('stopout', 'urgent', 'alert', 'STOP-OUT', [d.level != null ? `margin level ${Math.round(d.level)} %` : null, sym(d)], 'shake', Number.isFinite(d.pnl) ? { to: d.pnl } : null)
    case 'alert.price': return mk('alert', 'warn', 'bell', 'PRICE ALERT', [d.symbol, d.price != null ? `@ ${priceTxt(d.price)}` : evt.text], 'pop')
    case 'connection.lost': return mk('conn-lost', 'warn', 'wifi', 'CONNECTION LOST', [evt.text], 'fade')
    case 'connection.restored': return mk('conn-restored', 'win', 'wifi', 'BACK ONLINE', [evt.text], 'fade')
    default: return null
  }
}

// ── chart effects ───────────────────────────────────────────────────────
// Returns the list of effects to draw on the chart showing evt.data.symbol (or all charts when no symbol).
// kind: lineDraw | ring | shock | crack | badge | vignette | pulse | banner. color: up | down | amber | accent.
export function chartEffectsFor(evt, mode, anim) {
  if (!evt || mode === 'off' || !anim) return []
  const d = evt.data || {}
  const reduced = mode === 'reduced'
  const base = { symbol: d.symbol || null, price: Number.isFinite(d.price) ? d.price : null }
  const fx = (kind, color, ms, extra = {}) => ({ ...base, kind, color, ms: reduced && kind !== 'banner' ? 400 : ms, ...extra })
  const badge = (text, color) => fx('badge', color, reduced ? 800 : 1500, { text })
  switch (evt.id) {
    case 'order.buy.filled': case 'order.sell.filled':
      return anim.fxEntry && !reduced && base.price != null ? [fx('lineDraw', evt.id.includes('buy') ? 'up' : 'down', 300)] : []
    case 'order.pending.triggered': {
      if (!anim.fxTrigger) return []
      const stop = d.orderType === 'stop' || d.orderType === 'stoplimit'
      return [...(reduced ? [] : [fx('ring', d.side === 'sell' ? 'down' : 'up', 900)]), badge(stop ? 'STOP TRIGGERED' : 'LIMIT FILLED', 'accent')]
    }
    case 'position.tp.hit':
      return anim.fxTp ? [...(reduced ? [] : [fx('shock', 'up', 1000)]), badge(`TARGET HIT ${signedMoney(d.pnl || 0)}`, 'up')] : []
    case 'position.sl.hit':
      return anim.fxSl ? [...(reduced ? [] : [fx('crack', 'down', 250)]), badge(`STOPPED OUT ${signedMoney(d.pnl || 0)}`, 'down')] : []
    case 'account.margin.warning':
      return anim.fxMargin ? [fx('pulse', 'amber', reduced ? 1500 : 4000, { symbol: null })] : []
    case 'account.stopout':
      return anim.fxStopout ? [...(reduced ? [] : [fx('vignette', 'down', 400, { symbol: null })]), fx('banner', 'down', 0, { symbol: null, text: d.level != null ? `STOP-OUT — margin level ${Math.round(d.level)} %` : 'STOP-OUT — positions were closed' })] : []
    case 'alert.price':
      return anim.fxAlert ? [...(reduced ? [] : [fx('ring', 'amber', 1200)]), badge('ALERT', 'amber')] : []
    default: return []
  }
}

// ── effect queue: at most `cap` effects alive; the oldest is dropped when a new one needs room ──
export function createEffectQueue(cap = 6) {
  let list = []
  let seq = 0
  const prune = (now) => { list = list.filter((e) => e.ms === 0 || now < e.t0 + e.ms) }
  return {
    add(effect, now) {
      prune(now)
      while (list.length >= cap) list.shift()
      const e = { ...effect, id: ++seq, t0: now }
      list.push(e)
      return e
    },
    active(now) { prune(now); return list.slice() },
    remove(id) { list = list.filter((e) => e.id !== id) },
    clear() { list = [] },
    size: () => list.length,
  }
}

// ── frame governor: frames slower than limitMs for windowMs straight -> trips ONCE ──
export function createFrameGovernor({ limitMs = 24, windowMs = 1000 } = {}) {
  let slowSince = null
  let tripped = false
  return {
    frame(dt, now) {
      if (tripped) return false
      if (dt > limitMs) {
        if (slowSince === null) slowSince = now
        if (now - slowSince >= windowMs) { tripped = true; return true }
      } else slowSince = null
      return false
    },
    reset() { slowSince = null; tripped = false },
  }
}

// ── margin watcher: fires once when the margin state falls into warn / danger, re-arms when it is ok again ──
export function createMarginWatcher() {
  let armed = true
  return {
    step(state) {
      if (state === 'ok' || state === 'none') { armed = true; return false }
      if ((state === 'warn' || state === 'danger') && armed) { armed = false; return true }
      return false
    },
  }
}

// ── data for events ─────────────────────────────────────────────────────
// A ledger event -> the facts the popup / chart effect need.
export function dataForLedger(e) {
  if (!e) return {}
  const t = e.trade
  switch (e.type) {
    case 'fill': return { side: e.order.side, symbol: e.order.symbol, lots: e.order.lots, price: e.position && e.position.entry, orderType: e.order.type, sl: e.position && e.position.sl, tp: e.position && e.position.tp }
    case 'trigger': return { side: e.order.side, symbol: e.order.symbol, lots: e.order.lots, price: e.order.price, orderType: e.order.type }
    case 'sl': case 'tp': case 'ptp': case 'stopout': return t ? { side: t.side, symbol: t.symbol, lots: t.lots, price: t.exit, pnl: t.pnl } : {}
    case 'rejected': return { side: e.order.side, symbol: e.order.symbol, lots: e.order.lots, orderType: e.order.type, reason: e.error }
    case 'expired': case 'oco': return { side: e.order.side, symbol: e.order.symbol, lots: e.order.lots }
    default: return {}
  }
}

// Sample facts for the Effects playground (one button per event).
export function sampleData(id, { symbol = 'XAUUSD', price = 4300 } = {}) {
  const base = { symbol, lots: 0.5, price }
  switch (id) {
    case 'order.buy.filled': return { ...base, side: 'buy', sl: price - 5, tp: price + 10 }
    case 'order.sell.filled': return { ...base, side: 'sell', sl: price + 5, tp: price - 10 }
    case 'order.pending.placed': return { ...base, side: 'buy', orderType: 'limit' }
    case 'order.pending.triggered': return { ...base, side: 'buy', orderType: 'limit' }
    case 'order.modified': return { symbol, text: `SL moved ${price - 5} → ${price - 4}` }
    case 'order.cancelled': return base
    case 'order.rejected': return { ...base, reason: 'Not enough free margin' }
    case 'position.closed.win': case 'position.tp.hit': case 'position.partial': return { ...base, pnl: 90 }
    case 'position.closed.loss': case 'position.sl.hit': return { ...base, pnl: -45 }
    case 'position.closed.flat': return { ...base, pnl: 0 }
    case 'position.reversed': return { ...base, side: 'sell' }
    case 'account.margin.warning': return { level: 92 }
    case 'account.stopout': return { ...base, level: 42, pnl: -820 }
    case 'alert.price': return { symbol, price }
    default: return { symbol }
  }
}
