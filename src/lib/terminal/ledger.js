// Pure account ledger for the demo terminal. No React, no storage — unit-tested directly.
// Ledger: { account:{balance,startBalance,currency,leverage,createdAt}, positions[], orders[], history[], nextId }
// Every function returns a NEW ledger (or {error}).
import { INSTRUMENTS } from './instruments.js'
import * as E from './engine.js'

export const LEVERAGES = [1, 5, 10, 20, 30, 50, 100, 200, 300, 500]
export const DEFAULT_STOP_OUT = 50
export const MAX_COMMISSION = 100 // USD per lot — a sanity limit for the setting
const nowSec = () => Math.floor(Date.now() / 1000)

export const createLedger = (balance = 10000, leverage = 100, now = nowSec()) => ({
  account: { balance, startBalance: balance, currency: 'USD', leverage, createdAt: now },
  positions: [],
  orders: [],
  history: [],
  transactions: [], // virtual deposits / withdrawals
  nextId: 1,
})

export const metricsFor = (ledger, quotes) =>
  E.accountMetrics({
    balance: ledger.account.balance,
    positions: ledger.positions,
    quotes,
    instruments: INSTRUMENTS,
    leverage: ledger.account.leverage,
  })

const missingQuote = (ledger, quotes) => ledger.positions.some((p) => !quotes[p.symbol])
const patchPosition = (ledger, id, patch) => ({
  ...ledger,
  positions: ledger.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
})
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

// End of the local day (for "today" / a picked date), or null for good-till-cancelled.
export function expiryTs(expiry, now = nowSec()) {
  if (!expiry || expiry.kind === 'gtc') return null
  if (expiry.kind === 'day') return Math.floor(new Date(now * 1000).setHours(23, 59, 59, 999) / 1000)
  if (expiry.kind === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry.date || '')
    if (!m) return NaN
    return Math.floor(new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999).getTime() / 1000)
  }
  return null
}

// ── Market orders / positions ────────────────────────────────────────────

// opts: { entry (override fill price), skipStops, approx, fromOrder }
export function openPosition(ledger, { symbol, side, lots, sl = null, tp = null, tf }, quotes, now = nowSec(), opts = {}) {
  const inst = INSTRUMENTS[symbol]
  const q = quotes[symbol]
  if (!inst) return { error: 'Unknown symbol' }
  if (side !== 'buy' && side !== 'sell') return { error: 'Choose BUY or SELL' }
  if (!q || missingQuote(ledger, quotes)) return { error: 'Waiting for live prices — try again in a moment', code: 'noquote' }
  if (!opts.skipStops) {
    const stopErr = E.validateStops(side, q, sl, tp, inst)
    if (stopErr) return { error: stopErr }
  }
  const entry = opts.entry != null ? opts.entry : E.entryPrice(side, q)
  const ev = E.evaluateOrder({
    side, lots, quote: opts.entry != null ? { bid: entry, ask: entry } : q, inst,
    leverage: ledger.account.leverage, metrics: metricsFor(ledger, quotes),
  })
  if (ev.error) return { error: ev.error }
  const position = {
    id: `p${ledger.nextId}`, symbol, side, lots, entry, sl, tp,
    trail: null, beAfter: null, partialTp: null,
    leverage: ledger.account.leverage, openTime: now,
    ...(tf ? { tf } : {}),
    ...(opts.approx ? { approx: true } : {}),
    ...(opts.fromOrder ? { fromOrder: opts.fromOrder } : {}),
  }
  return { position, ledger: { ...ledger, nextId: ledger.nextId + 1, positions: [...ledger.positions, position] } }
}

// Close all (default) or part (`lots`) of a position. opts: { lots, reason, now, exit, approx }
export function closePosition(ledger, id, quotes, { lots, reason = 'manual', now = nowSec(), exit: exitOverride, approx = false } = {}) {
  const pos = ledger.positions.find((p) => p.id === id)
  if (!pos) return { error: 'Position not found' }
  const q = quotes[pos.symbol]
  if (!q) return { error: 'No live price for this symbol yet' }
  const closeLots = lots == null ? pos.lots : lots
  if (!(closeLots > 0) || closeLots > pos.lots + 1e-9) return { error: 'Invalid lots to close' }
  const inst = INSTRUMENTS[pos.symbol]
  const exit = exitOverride != null ? exitOverride : E.exitPrice(pos.side, q)
  const s = E.settleClose(pos, closeLots, exit, inst)
  // Commission is a per-lot account setting (account.commission, USD), charged when lots are
  // closed. history.pnl is NET of it, so stats / equity curve / journal stay correct untouched.
  const commission = E.roundMoney(s.lots * (ledger.account.commission || 0))
  const net = E.roundMoney(s.pnl - commission)
  const trade = {
    id: `h${ledger.nextId}`, positionId: pos.id, symbol: pos.symbol, side: pos.side, lots: s.lots,
    entry: pos.entry, exit, sl: pos.sl ?? null, tp: pos.tp ?? null, openTime: pos.openTime, closeTime: now, pnl: net, pips: s.pips, reason,
    ...(commission > 0 ? { commission } : {}),
    ...(pos.tf ? { tf: pos.tf } : {}),
    ...(approx || pos.approx ? { approx: true } : {}),
  }
  const positions = s.remaining > 1e-9
    ? ledger.positions.map((p) => (p.id === id ? { ...p, lots: s.remaining } : p))
    : ledger.positions.filter((p) => p.id !== id)
  return {
    trade,
    ledger: {
      ...ledger,
      nextId: ledger.nextId + 1,
      account: { ...ledger.account, balance: E.roundMoney(ledger.account.balance + net) },
      positions,
      history: [trade, ...ledger.history],
    },
  }
}

export function closeMany(ledger, ids, quotes, reason = 'manual', now = nowSec()) {
  let cur = ledger
  const trades = []
  for (const id of ids) {
    const r = closePosition(cur, id, quotes, { reason, now })
    if (!r.error) { cur = r.ledger; trades.push(r.trade) }
  }
  return { ledger: cur, trades }
}

export function partialClose(ledger, id, pct, quotes, now = nowSec()) {
  const pos = ledger.positions.find((p) => p.id === id)
  if (!pos) return { error: 'Position not found' }
  const sp = E.splitLots(pos.lots, pct, INSTRUMENTS[pos.symbol])
  if (sp.error) return { error: sp.error }
  return closePosition(ledger, id, quotes, { lots: sp.lots, now })
}

// Close, then open the opposite side with the same lots. All-or-nothing.
export function reversePosition(ledger, id, quotes, now = nowSec()) {
  const pos = ledger.positions.find((p) => p.id === id)
  if (!pos) return { error: 'Position not found' }
  const c = closePosition(ledger, id, quotes, { reason: 'reverse', now })
  if (c.error) return c
  const o = openPosition(c.ledger, { symbol: pos.symbol, side: pos.side === 'buy' ? 'sell' : 'buy', lots: pos.lots }, quotes, now)
  if (o.error) return { error: o.error }
  return { ledger: o.ledger, trade: c.trade, position: o.position }
}

// ── Modify position: SL / TP / trailing / auto-break-even / partial TP ──

export function modifyPosition(ledger, id, patch, quotes) {
  const pos = ledger.positions.find((p) => p.id === id)
  if (!pos) return { error: 'Position not found' }
  const inst = INSTRUMENTS[pos.symbol]
  const next = {}
  if (has(patch, 'sl') || has(patch, 'tp')) {
    const q = quotes[pos.symbol]
    if (!q) return { error: 'Waiting for live price…' }
    const sl = has(patch, 'sl') ? patch.sl : pos.sl
    const tp = has(patch, 'tp') ? patch.tp : pos.tp
    // only validate the side(s) being changed, so an old level can't block editing the other one
    const err = E.validateStops(pos.side, q, has(patch, 'sl') ? sl : null, has(patch, 'tp') ? tp : null, inst)
    if (err) return { error: err }
    if (has(patch, 'sl')) next.sl = sl
    if (has(patch, 'tp')) next.tp = tp
  }
  if (has(patch, 'trail')) {
    if (patch.trail != null && !(patch.trail > 0)) return { error: 'Trailing distance must be above 0 pips' }
    next.trail = patch.trail
  }
  if (has(patch, 'beAfter')) {
    if (patch.beAfter != null && !(patch.beAfter > 0)) return { error: 'Auto break-even pips must be above 0' }
    next.beAfter = patch.beAfter
  }
  if (has(patch, 'partialTp')) {
    const p = patch.partialTp
    if (p != null) {
      if (!(p.pips > 0)) return { error: 'Partial TP pips must be above 0' }
      if (!(p.pct >= 1 && p.pct <= 99)) return { error: 'Partial TP % must be between 1 and 99' }
      if (E.splitLots(pos.lots, p.pct, inst).error) return { error: 'Position too small for that partial close' }
    }
    next.partialTp = p
  }
  return { ledger: patchPosition(ledger, id, next) }
}

export function breakEven(ledger, id, quotes) {
  const pos = ledger.positions.find((p) => p.id === id)
  if (!pos) return { error: 'Position not found' }
  const q = quotes[pos.symbol]
  if (!q) return { error: 'Waiting for live price…' }
  const inProfit = pos.side === 'buy' ? q.bid > pos.entry : q.ask < pos.entry
  if (!inProfit) return { error: 'Break-even needs price beyond your entry' }
  return modifyPosition(ledger, id, { sl: pos.entry }, quotes)
}

// ── Pending orders ───────────────────────────────────────────────────────

// spec: { symbol, type:'limit'|'stop'|'stoplimit', side, lots, price, limitPrice?, sl?, tp?, expiry?, ocoWith? }
export function placeOrder(ledger, spec, quotes, now = nowSec()) {
  const { symbol, type, side, lots, price, limitPrice = null, sl = null, tp = null, expiry, ocoWith = null, tf } = spec
  const inst = INSTRUMENTS[symbol]
  const q = quotes[symbol]
  if (!inst) return { error: 'Unknown symbol' }
  if (side !== 'buy' && side !== 'sell') return { error: 'Choose BUY or SELL' }
  if (!q) return { error: 'Waiting for live prices — try again in a moment' }
  const lotErr = E.validateLots(lots, inst)
  if (lotErr) return { error: lotErr }
  const pErr = E.validatePending({ type, side, price, limitPrice }, q, inst)
  if (pErr) return { error: pErr }
  const sErr = E.validateStopsAt(side, type === 'stoplimit' ? limitPrice : price, sl, tp, inst)
  if (sErr) return { error: sErr }
  const expiresAt = expiryTs(expiry, now)
  if (Number.isNaN(expiresAt)) return { error: 'Pick an expiry date' }
  if (expiresAt != null && expiresAt <= now) return { error: 'Expiry is in the past' }
  let orders = ledger.orders || []
  let oco = null
  if (ocoWith) {
    const other = orders.find((o) => o.id === ocoWith)
    if (!other) return { error: 'The order to link with no longer exists' }
    oco = other.oco || `g${ledger.nextId}`
    orders = orders.map((o) => (o.id === ocoWith ? { ...o, oco } : o))
  }
  const order = {
    id: `o${ledger.nextId}`, symbol, type, side, lots, price,
    limitPrice: type === 'stoplimit' ? limitPrice : null, sl, tp, expiresAt, oco,
    triggered: false, createdAt: now,
    ...(tf ? { tf } : {}),
  }
  return { order, ledger: { ...ledger, nextId: ledger.nextId + 1, orders: [...orders, order] } }
}

export function cancelOrder(ledger, id) {
  const o = (ledger.orders || []).find((x) => x.id === id)
  if (!o) return { error: 'Order not found' }
  return { order: o, ledger: { ...ledger, orders: ledger.orders.filter((x) => x.id !== id) } }
}

// patch: { price?, limitPrice?, sl?, tp? } — a triggered stop-limit can only change its limit/SL/TP.
export function modifyOrder(ledger, id, patch, quotes) {
  const o = (ledger.orders || []).find((x) => x.id === id)
  if (!o) return { error: 'Order not found' }
  const inst = INSTRUMENTS[o.symbol]
  const q = quotes[o.symbol]
  if (!q) return { error: 'Waiting for live price…' }
  if (o.triggered && has(patch, 'price')) return { error: 'This stop-limit is already triggered' }
  const n = { ...o, ...patch }
  if (!o.triggered) {
    const pErr = E.validatePending(n, q, inst)
    if (pErr) return { error: pErr }
  }
  const sErr = E.validateStopsAt(n.side, n.type === 'stoplimit' ? n.limitPrice : n.price, n.sl, n.tp, inst)
  if (sErr) return { error: sErr }
  return { order: n, ledger: { ...ledger, orders: ledger.orders.map((x) => (x.id === id ? n : x)) } }
}

// ── One price update: expiry → pending fills → SL/TP/partial/BE/trail → stop-out ──
// opts: { stopOutLevel, now, continuous (price moved continuously, so levels fill AT the level),
//         approx (replaying history) }.  Returns null when nothing changed.
export function processTick(ledger, quotes, opts = {}) {
  const { stopOutLevel = DEFAULT_STOP_OUT, now = nowSec(), continuous = false, approx = false } = opts
  if (!ledger.positions.length && !(ledger.orders || []).length) return null
  let cur = { ...ledger, orders: ledger.orders || [] }
  let changed = false
  const events = []
  const ev = (e) => events.push({ ...e, time: now, ...(approx ? { approx: true } : {}) })

  // 1. expiry
  for (const o of cur.orders) {
    if (o.expiresAt != null && now >= o.expiresAt) {
      cur = { ...cur, orders: cur.orders.filter((x) => x.id !== o.id) }
      changed = true
      ev({ type: 'expired', order: o })
    }
  }

  // 2. pending orders
  for (const o of [...cur.orders]) {
    if (!cur.orders.some((x) => x.id === o.id)) continue // cancelled by an OCO sibling this tick
    const q = quotes[o.symbol]
    if (!q) continue
    const hit = E.checkOrder(o, q)
    if (!hit) continue
    if (hit === 'trigger') {
      cur = { ...cur, orders: cur.orders.map((x) => (x.id === o.id ? { ...x, triggered: true } : x)) }
      changed = true
      ev({ type: 'trigger', order: o })
      continue
    }
    const fillPx = continuous ? E.orderFillLevel(o) : E.entryPrice(o.side, q)
    const base = { ...cur, orders: cur.orders.filter((x) => x.id !== o.id) }
    const r = openPosition(base, { symbol: o.symbol, side: o.side, lots: o.lots, sl: o.sl, tp: o.tp, tf: o.tf }, quotes, now, {
      entry: fillPx, skipStops: true, approx, fromOrder: o.id,
    })
    if (r.code === 'noquote') continue
    changed = true
    if (r.error) { cur = base; ev({ type: 'rejected', order: o, error: r.error }); continue }
    cur = r.ledger
    ev({ type: 'fill', order: o, position: r.position })
    if (o.oco) {
      for (const s of cur.orders.filter((x) => x.oco === o.oco)) {
        cur = { ...cur, orders: cur.orders.filter((x) => x.id !== s.id) }
        ev({ type: 'oco', order: s })
      }
    }
  }

  // 3. open positions: SL/TP → partial TP → auto break-even → trailing
  for (const id of cur.positions.map((p) => p.id)) {
    let p = cur.positions.find((x) => x.id === id)
    const q = p && quotes[p.symbol]
    if (!q) continue
    const inst = INSTRUMENTS[p.symbol]
    const hit = E.checkSlTp(p, q)
    if (hit) {
      const level = hit === 'sl' ? p.sl : p.tp
      const r = closePosition(cur, id, quotes, { reason: hit, now, approx, exit: continuous ? level : undefined })
      if (!r.error) { cur = r.ledger; changed = true; ev({ type: hit, trade: r.trade }) }
      continue
    }
    const pips = E.pipsMoved(p.side, p.entry, E.exitPrice(p.side, q), inst)
    if (p.partialTp && pips >= p.partialTp.pips) {
      const sp = E.splitLots(p.lots, p.partialTp.pct, inst)
      if (!sp.error) {
        const r = closePosition(cur, id, quotes, {
          lots: sp.lots, reason: 'ptp', now, approx,
          exit: continuous ? E.priceAtPips(p.side, p.entry, p.partialTp.pips, inst) : undefined,
        })
        if (!r.error) { cur = r.ledger; ev({ type: 'ptp', trade: r.trade }) }
      }
      cur = patchPosition(cur, id, { partialTp: null })
      changed = true
      p = cur.positions.find((x) => x.id === id)
      if (!p) continue
    }
    if (p.beAfter && pips >= p.beAfter && (p.sl == null || (p.side === 'buy' ? p.sl < p.entry : p.sl > p.entry))) {
      cur = patchPosition(cur, id, { sl: p.entry, beAfter: null })
      changed = true
      ev({ type: 'be', position: { ...p, sl: p.entry } })
      p = cur.positions.find((x) => x.id === id)
    }
    const t = E.trailTarget(p, q, inst)
    if (t != null) { cur = patchPosition(cur, id, { sl: t }); changed = true }
  }

  // 4. stop-out (worst loser first)
  if (cur.positions.length && !missingQuote(cur, quotes)) {
    for (let i = 0; i < 100; i++) {
      const id = E.stopOutCandidate(metricsFor(cur, quotes), stopOutLevel)
      if (!id) break
      const r = closePosition(cur, id, quotes, { reason: 'stopout', now, approx })
      if (r.error) break
      cur = r.ledger
      changed = true
      ev({ type: 'stopout', trade: r.trade })
    }
  }
  return changed ? { ledger: cur, events } : null
}

// ── Offline catch-up ─────────────────────────────────────────────────────
// Replays 1-minute candles (oldest first) to trigger what price would have triggered while
// the app was closed. Inside one candle price is assumed to visit the extreme that hurts the
// open positions FIRST (so SL beats TP when both fit in one candle); with no positions it
// goes low-first on a rising candle and high-first on a falling one. Every event is
// marked approx. args: candles { SYMBOL: [{time,open,high,low,close}] }, startMids { SYMBOL: mid }
// Call as catchUp(ledger, candles, startMids, { stopOutLevel, quoteFromMid })
//     or  catchUp(ledger, { candles, startMids, quoteOf, stopOutLevel }).
export function catchUp(ledger, a, b, c) {
  const objForm = b === undefined && a && a.candles
  const candles = objForm ? a.candles : a
  const startMids = objForm ? a.startMids : b
  const quoteFromMid = objForm ? a.quoteOf : c?.quoteFromMid
  const stopOutLevel = (objForm ? a.stopOutLevel : c?.stopOutLevel) ?? DEFAULT_STOP_OUT
  const steps = []
  for (const sym of Object.keys(candles)) for (const c of candles[sym]) steps.push({ sym, c })
  steps.sort((a, b) => a.c.time - b.c.time)
  const q = {}
  for (const sym of Object.keys(startMids)) q[sym] = quoteFromMid(sym, startMids[sym])
  let cur = ledger
  const events = []
  for (const { sym, c } of steps) {
    const buyLots = cur.positions.filter((p) => p.symbol === sym && p.side === 'buy').reduce((a, p) => a + p.lots, 0)
    const sellLots = cur.positions.filter((p) => p.symbol === sym && p.side === 'sell').reduce((a, p) => a + p.lots, 0)
    const lowFirst = buyLots + sellLots > 0 ? buyLots >= sellLots : c.close >= c.open
    const path = lowFirst ? [c.open, c.low, c.high, c.close] : [c.open, c.high, c.low, c.close]
    for (let i = 0; i < path.length; i++) {
      q[sym] = quoteFromMid(sym, path[i], c.time + i * 15)
      const r = processTick(cur, q, { stopOutLevel, now: c.time + i * 15, continuous: true, approx: true })
      if (r) { cur = r.ledger; events.push(...r.events) }
    }
  }
  return { ledger: cur, events }
}

// ── Account actions (all virtual money) ──────────────────────────────────
export const MIN_START = 10
export const MAX_BALANCE = 100_000_000

function addTransaction(ledger, type, amount, now) {
  const signed = type === 'deposit' ? amount : -amount
  const balance = E.roundMoney(ledger.account.balance + signed)
  const tx = { id: `x${ledger.nextId}`, type, amount, time: now, balanceAfter: balance }
  return {
    transaction: tx,
    ledger: {
      ...ledger,
      nextId: ledger.nextId + 1,
      account: { ...ledger.account, balance },
      transactions: [tx, ...(ledger.transactions || [])],
    },
  }
}

export function deposit(ledger, amount, now = nowSec()) {
  const a = E.roundMoney(Number(amount))
  if (!Number.isFinite(a) || a <= 0) return { error: 'Enter an amount above 0' }
  if (ledger.account.balance + a > MAX_BALANCE) return { error: `Balance can't exceed $${MAX_BALANCE.toLocaleString('en-US')}` }
  return addTransaction(ledger, 'deposit', a, now)
}

// You can only withdraw what isn't tied up as margin (and never more than the balance).
export function withdraw(ledger, amount, quotes, now = nowSec()) {
  const a = E.roundMoney(Number(amount))
  if (!Number.isFinite(a) || a <= 0) return { error: 'Enter an amount above 0' }
  if (missingQuote(ledger, quotes)) return { error: 'Waiting for live prices — try again in a moment' }
  const m = metricsFor(ledger, quotes)
  const max = Math.max(0, Math.min(ledger.account.balance, m.freeMargin))
  if (a > max + 1e-9) return { error: `You can withdraw at most $${E.roundMoney(max).toLocaleString('en-US', { minimumFractionDigits: 2 })} right now (free margin)` }
  return addTransaction(ledger, 'withdraw', a, now)
}

// Wipes positions, orders, history and transactions; starts again from `startBalance`.
export function resetLedger(startBalance, leverage = 100, now = nowSec()) {
  const b = Number(startBalance)
  if (!Number.isFinite(b) || b < MIN_START) return { error: `Starting balance must be at least $${MIN_START}` }
  if (b > MAX_BALANCE) return { error: `Starting balance can't exceed $${MAX_BALANCE.toLocaleString('en-US')}` }
  if (!LEVERAGES.includes(leverage)) return { error: 'Unsupported leverage' }
  return { ledger: createLedger(E.roundMoney(b), leverage, now) }
}
