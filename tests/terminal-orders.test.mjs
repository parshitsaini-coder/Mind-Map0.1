// Phase 4: pending orders, gap fills, OCO, expiry, trailing, break-even, partial TP, offline catch-up.
// Run: node tests/terminal-orders.test.mjs
import { INSTRUMENTS as I } from '../src/lib/terminal/instruments.js'
import * as E from '../src/lib/terminal/engine.js'
import * as L from '../src/lib/terminal/ledger.js'
import * as F from '../src/lib/terminal/feed/simulatedFeed.js'

let fail = 0
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }
const qt = (bid, ask) => ({ bid, ask })
const EU = (bid, ask) => ({ EURUSD: qt(bid, ask) })
const base = L.createLedger(10000, 100, 1000)
const M = EU(1.0999, 1.1001) // market at 1.1000, 2-pip-ish spread
const place = (spec, quotes = M, led = base) => L.placeOrder(led, { symbol: 'EURUSD', lots: 0.1, ...spec }, quotes, 1000)

// ── validation ──
const v = (o, q = qt(1.0999, 1.1001)) => E.validatePending({ ...o }, q, I.EURUSD)
check('BUY LIMIT below ask ok / above rejected', v({ type: 'limit', side: 'buy', price: 1.095 }) === null && !!v({ type: 'limit', side: 'buy', price: 1.101 }))
check('SELL LIMIT above bid ok / below rejected', v({ type: 'limit', side: 'sell', price: 1.105 }) === null && !!v({ type: 'limit', side: 'sell', price: 1.099 }))
check('BUY STOP above ask ok / below rejected', v({ type: 'stop', side: 'buy', price: 1.105 }) === null && !!v({ type: 'stop', side: 'buy', price: 1.099 }))
check('SELL STOP below bid ok / above rejected', v({ type: 'stop', side: 'sell', price: 1.095 }) === null && !!v({ type: 'stop', side: 'sell', price: 1.1005 }))
check('BUY STOP-LIMIT: stop above ask, limit below stop', v({ type: 'stoplimit', side: 'buy', price: 1.105, limitPrice: 1.104 }) === null && !!v({ type: 'stoplimit', side: 'buy', price: 1.105, limitPrice: 1.106 }) && !!v({ type: 'stoplimit', side: 'buy', price: 1.105 }))
check('SELL STOP-LIMIT: stop below bid, limit above stop', v({ type: 'stoplimit', side: 'sell', price: 1.095, limitPrice: 1.096 }) === null && !!v({ type: 'stoplimit', side: 'sell', price: 1.095, limitPrice: 1.094 }))
check('placeOrder rejects SL on wrong side of the order price', !!place({ type: 'limit', side: 'buy', price: 1.095, sl: 1.096 }).error)
check('placeOrder rejects bad lots', !!place({ type: 'limit', side: 'buy', price: 1.095, lots: 0.005 }).error)

// ── trigger sides (BUY uses ASK, SELL uses BID) ──
const o = (type, side, price, extra = {}) => ({ type, side, price, triggered: false, ...extra })
check('BUY LIMIT fills on ASK <= price, not on bid', E.checkOrder(o('limit', 'buy', 1.095), qt(1.0940, 1.0951)) === null && E.checkOrder(o('limit', 'buy', 1.095), qt(1.0938, 1.0950)) === 'fill')
check('SELL LIMIT fills on BID >= price', E.checkOrder(o('limit', 'sell', 1.105), qt(1.1049, 1.1060)) === null && E.checkOrder(o('limit', 'sell', 1.105), qt(1.1050, 1.1062)) === 'fill')
check('BUY STOP fills on ASK >= price', E.checkOrder(o('stop', 'buy', 1.105), qt(1.1050, 1.1049 + 0.0000)) === null && E.checkOrder(o('stop', 'buy', 1.105), qt(1.1049, 1.1051)) === 'fill')
check('SELL STOP fills on BID <= price', E.checkOrder(o('stop', 'sell', 1.095), qt(1.0951, 1.0953)) === null && E.checkOrder(o('stop', 'sell', 1.095), qt(1.0950, 1.0952)) === 'fill')

// ── fills: live tick (first available price) vs continuous (at the level) ──
let r = place({ type: 'stop', side: 'buy', price: 1.105, sl: 1.1, tp: 1.11 })
check('order placed', !r.error && r.ledger.orders.length === 1, r.error)
let t = L.processTick(r.ledger, EU(1.1049, 1.1051), { now: 1001 })
check('GAP: BUY STOP @1.1050 with ask jumping to 1.1051 fills at 1.1051 (worse), keeps SL/TP', t.events[0].type === 'fill' && t.ledger.positions[0].entry === 1.1051 && t.ledger.positions[0].sl === 1.1 && t.ledger.positions[0].tp === 1.11 && t.ledger.orders.length === 0, JSON.stringify(t?.events[0]))
t = L.processTick(r.ledger, EU(1.1049, 1.1051), { now: 1001, continuous: true })
check('continuous path: same order fills exactly AT 1.1050', t.ledger.positions[0].entry === 1.105)
r = place({ type: 'limit', side: 'buy', price: 1.095 })
t = L.processTick(r.ledger, EU(1.0900, 1.0902), { now: 1001 })
check('GAP: BUY LIMIT @1.0950, ask gaps down to 1.0902 → fills at 1.0902 (better)', t.ledger.positions[0].entry === 1.0902)
t = L.processTick(r.ledger, EU(1.0948, 1.0950), { now: 1001, continuous: true })
check('continuous: fills at the limit 1.0950', t.ledger.positions[0].entry === 1.095)
r = place({ type: 'limit', side: 'sell', price: 1.105 })
t = L.processTick(r.ledger, EU(1.1050, 1.1052), { now: 1001 })
check('SELL LIMIT fills on bid (bid 1.1050 ≥ 1.1050) → SELL opened at bid', t.ledger.positions[0].side === 'sell' && t.ledger.positions[0].entry === 1.105)

// ── stop-limit: stage 1 trigger, stage 2 limit fill ──
r = place({ type: 'stoplimit', side: 'buy', price: 1.105, limitPrice: 1.104 })
t = L.processTick(r.ledger, EU(1.1050, 1.1052), { now: 1001 })
check('stop-limit: stop touched → TRIGGER only, no position yet', t.events[0].type === 'trigger' && t.ledger.positions.length === 0 && t.ledger.orders[0].triggered)
const t2 = L.processTick(t.ledger, EU(1.1045, 1.1047), { now: 1002 })
check('stop-limit: still waiting while ask > limit (1.1047 > 1.1040)', t2 === null)
const t3 = L.processTick(t.ledger, EU(1.1038, 1.1040), { now: 1003 })
check('stop-limit: fills once ask <= limit 1.1040', t3.events[0].type === 'fill' && t3.ledger.positions.length === 1, JSON.stringify(t3?.events))

// ── expiry ──
r = place({ type: 'limit', side: 'buy', price: 1.095, expiry: { kind: 'day' } })
check('expiry "today" is end of local day', r.order.expiresAt > 1000 && !Number.isNaN(r.order.expiresAt))
t = L.processTick(r.ledger, M, { now: r.order.expiresAt + 1 })
check('order removed after expiry', t.events[0].type === 'expired' && t.ledger.orders.length === 0)
check('past date rejected', !!L.placeOrder(base, { symbol: 'EURUSD', lots: 0.1, type: 'limit', side: 'buy', price: 1.095, expiry: { kind: 'date', date: '2000-01-01' } }, M, Math.floor(Date.now() / 1000)).error)
check('missing date rejected', !!place({ type: 'limit', side: 'buy', price: 1.095, expiry: { kind: 'date', date: '' } }).error)

// ── OCO ──
const a = place({ type: 'stop', side: 'buy', price: 1.105 })
const b = L.placeOrder(a.ledger, { symbol: 'EURUSD', lots: 0.1, type: 'stop', side: 'sell', price: 1.095, ocoWith: a.order.id }, M, 1000)
check('OCO links both orders', b.ledger.orders.length === 2 && b.ledger.orders[0].oco && b.ledger.orders[0].oco === b.ledger.orders[1].oco)
t = L.processTick(b.ledger, EU(1.1049, 1.1051), { now: 1001 })
check('OCO: one fills → sibling cancelled', t.ledger.positions.length === 1 && t.ledger.orders.length === 0 && t.events.some((e) => e.type === 'oco'))

// ── margin at fill time ──
r = place({ type: 'limit', side: 'buy', price: 1.095, lots: 10 })
check('big order can be placed (margin is checked at fill)', !r.error)
t = L.processTick(r.ledger, EU(1.0948, 1.0950), { now: 1001 })
check('…but is REJECTED at fill when margin is short', t.events[0].type === 'rejected' && t.ledger.positions.length === 0 && t.ledger.orders.length === 0, JSON.stringify(t?.events))

// ── cancel / modify order ──
r = place({ type: 'limit', side: 'buy', price: 1.095 })
check('modify order price validated', !!L.modifyOrder(r.ledger, r.order.id, { price: 1.2 }, M).error && L.modifyOrder(r.ledger, r.order.id, { price: 1.09 }, M).ledger.orders[0].price === 1.09)
check('cancel order', L.cancelOrder(r.ledger, r.order.id).ledger.orders.length === 0)

// ── modify position / trailing / BE / partial TP ──
const open = (side = 'buy', lots = 1) => L.openPosition(base, { symbol: 'EURUSD', side, lots }, M, 1000)
let P = open()
const id = P.position.id // entry 1.1001
check('modify SL/TP validated vs bid', !!L.modifyPosition(P.ledger, id, { sl: 1.1 }, M).error && L.modifyPosition(P.ledger, id, { sl: 1.098, tp: 1.103 }, M).ledger.positions[0].sl === 1.098)
check('remove SL with null', L.modifyPosition(L.modifyPosition(P.ledger, id, { sl: 1.098 }, M).ledger, id, { sl: null }, M).ledger.positions[0].sl === null)
check('bad trail / BE / partial rejected', !!L.modifyPosition(P.ledger, id, { trail: 0 }, M).error && !!L.modifyPosition(P.ledger, id, { beAfter: -1 }, M).error && !!L.modifyPosition(P.ledger, id, { partialTp: { pips: 10, pct: 100 } }, M).error)
check('break-even refused while in loss', !!L.breakEven(P.ledger, id, M).error)
const up = EU(1.1049, 1.1051) // +48 pips on the bid
const be = L.breakEven(P.ledger, id, up)
check('break-even sets SL = entry when in profit', be.ledger.positions[0].sl === 1.1001)

// trailing 20 pips
let T = L.modifyPosition(P.ledger, id, { trail: 20 }, M).ledger
t = L.processTick(T, EU(1.1049, 1.1051), { now: 1001 })
check('trailing: bid 1.1049 → SL = 1.1049 − 20 pips = 1.1029', t.ledger.positions[0].sl === 1.1029, String(t?.ledger.positions[0].sl))
let T2 = t.ledger
t = L.processTick(T2, EU(1.1060, 1.1062), { now: 1002 })
check('trailing moves up with price: 1.1040', t.ledger.positions[0].sl === 1.104)
check('trailing never loosens when price falls back', L.processTick(t.ledger, EU(1.1050, 1.1052), { now: 1003 }) === null)
const trig = L.processTick(t.ledger, EU(1.1039, 1.1041), { now: 1004 })
check('trailed SL fires: closes with locked profit', trig.events[0].type === 'sl' && trig.events[0].trade.pnl > 0, JSON.stringify(trig?.events[0].trade))
check('trailing waits until price is beyond entry by the distance', L.processTick(T, EU(1.1010, 1.1012), { now: 1001 }) === null)

// auto break-even after 30 pips
let A = L.modifyPosition(P.ledger, id, { beAfter: 30 }, M).ledger
check('auto-BE not before 30 pips', L.processTick(A, EU(1.1020, 1.1022), { now: 1 }) === null)
t = L.processTick(A, EU(1.1040, 1.1042), { now: 1001 })
check('auto-BE at +30 pips → SL = entry, rule cleared', t.events[0].type === 'be' && t.ledger.positions[0].sl === 1.1001 && t.ledger.positions[0].beAfter === null)

// partial TP: close 50% at +20 pips
let PT = L.modifyPosition(P.ledger, id, { partialTp: { pips: 20, pct: 50 } }, M).ledger
t = L.processTick(PT, EU(1.1030, 1.1032), { now: 1001 })
check('partial TP closes 50% (0.5 lot) and clears the rule', t.events[0].type === 'ptp' && t.ledger.positions[0].lots === 0.5 && t.ledger.positions[0].partialTp === null && t.events[0].trade.lots === 0.5, JSON.stringify(t?.events))
t = L.processTick(PT, EU(1.1030, 1.1032), { now: 1001, continuous: true })
check('partial TP on a continuous path fills at exactly +20 pips (1.1021): 0.5×20pips×$10 = +$100', t.events[0].trade.exit === 1.1021 && t.events[0].trade.pnl === 100, JSON.stringify(t?.events[0].trade))

// ── offline catch-up ──
const qm = (sym, mid, time) => ({ symbol: sym, time, mid, ...E.applySpread(mid, I[sym].spread, I[sym].digits) })
const cu = (led, candles, startMid = 1.1) => L.catchUp(led, { EURUSD: candles }, { EURUSD: startMid }, { quoteFromMid: qm })
// BUY with SL 1.0950 and TP 1.1050; one candle spans BOTH
let SLTP = L.modifyPosition(P.ledger, id, { sl: 1.095, tp: 1.105 }, M).ledger
let c = cu(SLTP, [{ time: 2000, open: 1.1, high: 1.106, low: 1.094, close: 1.1 }])
check('SL and TP both inside one candle → SL assumed first (conservative), marked approx', c.events[0].type === 'sl' && c.events[0].approx && c.ledger.positions.length === 0, JSON.stringify(c.events.map((e) => e.type)))
check('…fill is AT the SL level (1.0950), not the candle extreme', c.events[0].trade.exit === 1.095 && c.events[0].trade.approx === true)
let SELLP = L.openPosition(base, { symbol: 'EURUSD', side: 'sell', lots: 1 }, M, 1000)
SELLP = L.modifyPosition(SELLP.ledger, 'p1', { sl: 1.105, tp: 1.095 }, M).ledger
c = cu(SELLP, [{ time: 2000, open: 1.1, high: 1.106, low: 1.094, close: 1.1 }])
check('SELL position, same candle: adverse extreme (high) first → SL', c.events[0].type === 'sl')
c = cu(SLTP, [{ time: 2000, open: 1.1, high: 1.1, low: 1.1, close: 1.1 }, { time: 2060, open: 1.1, high: 1.1, low: 1.1, close: 1.1 }])
check('quiet candles trigger nothing', c.events.length === 0)
// pending order fills while away, then its TP in a later candle, in time order
let PEND = place({ type: 'limit', side: 'buy', price: 1.098, tp: 1.101 }).ledger
c = cu(PEND, [
  { time: 2000, open: 1.1, high: 1.1, low: 1.0975, close: 1.099 },
  { time: 2060, open: 1.099, high: 1.102, low: 1.0985, close: 1.101 },
])
check('catch-up: limit fills at 1.0980 in candle 1, TP hits at 1.1010 in candle 2 — in time order, both approx',
  c.events.map((e) => e.type).join() === 'fill,tp' && c.events.every((e) => e.approx) && c.events[0].position.entry === 1.098 && c.events[1].trade.exit === 1.101, JSON.stringify(c.events.map((e) => [e.type, e.trade?.exit ?? e.position?.entry])))
check('catch-up trade marked approx in history', c.ledger.history[0].approx === true)
// OCO inside catch-up
const oco1 = place({ type: 'stop', side: 'buy', price: 1.105 })
const oco2 = L.placeOrder(oco1.ledger, { symbol: 'EURUSD', lots: 0.1, type: 'stop', side: 'sell', price: 1.095, ocoWith: oco1.order.id }, M, 1000)
c = cu(oco2.ledger, [{ time: 2000, open: 1.1, high: 1.106, low: 1.094, close: 1.1 }])
check('catch-up respects OCO (only one side opens)', c.ledger.positions.length <= 1 && c.events.filter((e) => e.type === 'fill').length === 1)

// ── deterministic feed: history, live ticks and reload agree ──
const tNow = Math.floor(Date.now() / 1000)
check('feed: price at a time is identical on every call', F.getMidAt('XAUUSD', tNow) === F.getMidAt('XAUUSD', tNow))
const mm = Math.floor(tNow / 60) * 60
const lastM1 = F.getCandles('EURUSD', 'M1', 2).slice(-1)[0]
check('feed: live path starts exactly at the last history close', Math.abs(F.getMidAt('EURUSD', mm) - lastM1.close) / lastM1.close < 1e-4, `${F.getMidAt('EURUSD', mm)} vs ${lastM1.close}`)
const hist = F.getCandles('EURUSD', 'M1', 5000)
check('feed: M1 candles are valid (low<=open,close<=high) and chain open==previous close', hist.every((x, i) => x.low <= Math.min(x.open, x.close) + 1e-12 && x.high >= Math.max(x.open, x.close) - 1e-12 && (i === 0 || Math.abs(x.open - hist[i - 1].close) < 1e-9)))

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
