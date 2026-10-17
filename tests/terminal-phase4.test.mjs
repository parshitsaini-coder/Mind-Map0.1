// Phase 4: pending orders, gaps, OCO, expiry, trailing, break-even, partial TP, offline catch-up.
import './fixtures/legacyInstruments.js'
import { INSTRUMENTS as I } from '../src/lib/terminal/instruments.js'
import * as E from '../src/lib/terminal/engine.js'
import * as L from '../src/lib/terminal/ledger.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const qt = (bid, ask) => ({ bid, ask })
const L0 = L.createLedger(10000, 100, 1000)
const Q = { EURUSD: qt(1.0999, 1.1001) }
const place = (spec, l = L0, q = Q) => L.placeOrder(l, { symbol: 'EURUSD', lots: 0.1, ...spec }, q, 1000)

// ── validation ──
check('buy limit above ask rejected', !!place({ type: 'limit', side: 'buy', price: 1.101 }).error)
check('buy limit below ask ok', !place({ type: 'limit', side: 'buy', price: 1.095 }).error)
check('sell limit below bid rejected', !!place({ type: 'limit', side: 'sell', price: 1.09 }).error)
check('buy stop below ask rejected', !!place({ type: 'stop', side: 'buy', price: 1.09 }).error)
check('sell stop above bid rejected', !!place({ type: 'stop', side: 'sell', price: 1.11 }).error)
check('buy stop-limit needs limit < stop', !!place({ type: 'stoplimit', side: 'buy', price: 1.105, limitPrice: 1.106 }).error && !place({ type: 'stoplimit', side: 'buy', price: 1.105, limitPrice: 1.104 }).error)
check('order SL checked against order price (buy limit @1.095, SL 1.096 bad)', !!place({ type: 'limit', side: 'buy', price: 1.095, sl: 1.096 }).error)
check('expiry in the past rejected', !!L.placeOrder(L0, { symbol: 'EURUSD', lots: 0.1, type: 'limit', side: 'buy', price: 1.095, expiry: { kind: 'date', date: '2020-01-01' } }, Q).error)

// ── limit / stop fills, gap vs continuous ──
let o = place({ type: 'limit', side: 'buy', price: 1.095, sl: 1.09, tp: 1.11 })
check('no fill above the limit', L.processTick(o.ledger, { EURUSD: qt(1.0959, 1.0961) }) === null)
let t = L.processTick(o.ledger, { EURUSD: qt(1.0939, 1.0941) }) // gapped below the limit, live tick
check('buy limit gap fills at the ask (better price) 1.0941', t.events[0].type === 'fill' && t.ledger.positions[0].entry === 1.0941 && t.ledger.orders.length === 0, JSON.stringify(t?.events[0]))
t = L.processTick(o.ledger, { EURUSD: qt(1.0939, 1.0941) }, { continuous: true })
check('candle replay fills AT the limit 1.095', t.ledger.positions[0].entry === 1.095)
check('fill keeps SL/TP from the order', t.ledger.positions[0].sl === 1.09 && t.ledger.positions[0].tp === 1.11)
o = place({ type: 'stop', side: 'buy', price: 1.105 })
t = L.processTick(o.ledger, { EURUSD: qt(1.1069, 1.1071) })
check('buy stop gap fills WORSE: at ask 1.1071', t.ledger.positions[0].entry === 1.1071)
check('buy stop continuous fills at 1.105', L.processTick(o.ledger, { EURUSD: qt(1.1069, 1.1071) }, { continuous: true }).ledger.positions[0].entry === 1.105)
o = place({ type: 'stop', side: 'sell', price: 1.095 })
check('sell stop triggers on BID, fills at bid', L.processTick(o.ledger, { EURUSD: qt(1.0949, 1.0951) }).ledger.positions[0].entry === 1.0949 && L.processTick(o.ledger, { EURUSD: qt(1.0951, 1.0953) }) === null)
o = place({ type: 'limit', side: 'sell', price: 1.105 })
check('sell limit fills when BID >= price', L.processTick(o.ledger, { EURUSD: qt(1.1051, 1.1053) }).ledger.positions[0].side === 'sell')

// ── stop-limit: trigger first, then limit ──
o = place({ type: 'stoplimit', side: 'buy', price: 1.105, limitPrice: 1.104 })
t = L.processTick(o.ledger, { EURUSD: qt(1.1051, 1.1053) })
check('stop-limit triggers (no position yet)', t.events[0].type === 'trigger' && t.ledger.positions.length === 0 && t.ledger.orders[0].triggered)
check('triggered stop-limit waits while ask > limit', L.processTick(t.ledger, { EURUSD: qt(1.1049, 1.1051) }) === null)
t = L.processTick(t.ledger, { EURUSD: qt(1.1029, 1.1031) })
check('then fills when ask <= limit (1.1031)', t.events[0].type === 'fill' && t.ledger.positions[0].entry === 1.1031)

// ── expiry ──
o = place({ type: 'limit', side: 'buy', price: 1.095, expiry: { kind: 'day' } })
check('day order expires after end of day', L.processTick(o.ledger, Q, { now: o.order.expiresAt + 1 }).events[0].type === 'expired')
check('day order alive before', L.processTick(o.ledger, Q, { now: o.order.expiresAt - 10 }) === null)
check('GTC never expires', L.processTick(place({ type: 'limit', side: 'buy', price: 1.095 }).ledger, Q, { now: 9e9 }) === null)

// ── OCO ──
let a = place({ type: 'stop', side: 'buy', price: 1.105 })
let b = L.placeOrder(a.ledger, { symbol: 'EURUSD', lots: 0.1, type: 'stop', side: 'sell', price: 1.095, ocoWith: a.order.id }, Q, 1000)
check('OCO links both orders', b.ledger.orders.every((x) => x.oco))
t = L.processTick(b.ledger, { EURUSD: qt(1.1049, 1.1051) }, { continuous: true })
check('one fills, the other is cancelled', t.ledger.positions.length === 1 && t.ledger.orders.length === 0 && t.events.some((e) => e.type === 'oco'))

// ── cancel / modify order ──
check('cancel order', L.cancelOrder(o.ledger, o.order.id).ledger.orders.length === 0)
check('modify order price validated', !!L.modifyOrder(o.ledger, o.order.id, { price: 1.2 }, Q).error && L.modifyOrder(o.ledger, o.order.id, { price: 1.09 }, Q).ledger.orders[0].price === 1.09)

// ── modify position, break-even ──
let P = L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 1, sl: 1.09 }, Q, 1000).ledger
const id = P.positions[0].id
check('modify SL ok / wrong side rejected', L.modifyPosition(P, id, { sl: 1.098 }, Q).ledger.positions[0].sl === 1.098 && !!L.modifyPosition(P, id, { sl: 1.2 }, Q).error)
check('remove SL with null', L.modifyPosition(P, id, { sl: null }, Q).ledger.positions[0].sl === null)
check('manual BE refused when not in profit', !!L.breakEven(P, id, Q).error)
check('manual BE moves SL to entry when in profit', L.breakEven(P, id, { EURUSD: qt(1.1049, 1.1051) }).ledger.positions[0].sl === 1.1001)
check('bad trail rejected', !!L.modifyPosition(P, id, { trail: -3 }, Q).error)

// auto break-even
let B = L.modifyPosition(P, id, { beAfter: 20 }, Q).ledger
check('auto-BE does not fire at +10 pips', L.processTick(B, { EURUSD: qt(1.1011, 1.1013) }) === null)
t = L.processTick(B, { EURUSD: qt(1.1031, 1.1033) })
check('auto-BE fires at +20 pips: SL -> entry, trigger cleared', t.ledger.positions[0].sl === 1.1001 && t.ledger.positions[0].beAfter === null && t.events[0].type === 'be')

// trailing: 20 pips
let T = L.modifyPosition(P, id, { trail: 20 }, Q).ledger
check('trailing waits until price is beyond entry by the distance', L.processTick(T, { EURUSD: qt(1.1011, 1.1013) }) === null)
t = L.processTick(T, { EURUSD: qt(1.1051, 1.1053) })
check('trail moves SL to bid − 20 pips = 1.1031', t.ledger.positions[0].sl === 1.1031)
check('SL never loosens when price falls back', L.processTick(t.ledger, { EURUSD: qt(1.1041, 1.1043) }) === null)
t = L.processTick(t.ledger, { EURUSD: qt(1.1030, 1.1032) })
check('trailed SL then closes the trade in profit', t.events[0].type === 'sl' && t.events[0].trade.pnl > 0, JSON.stringify(t?.events))
let TS = L.modifyPosition(L.openPosition(L0, { symbol: 'EURUSD', side: 'sell', lots: 1 }, Q, 1).ledger, 'p1', { trail: 20 }, Q).ledger
t = L.processTick(TS, { EURUSD: qt(1.0949, 1.0951) })
check('SELL trail: SL = ask + 20 pips = 1.0971', t.ledger.positions[0].sl === 1.0971)

// partial TP
let PT = L.modifyPosition(L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 1 }, Q, 1).ledger, 'p1', { partialTp: { pips: 30, pct: 50 } }, Q).ledger
check('partial TP not yet at +20', L.processTick(PT, { EURUSD: qt(1.1021, 1.1023) }) === null)
t = L.processTick(PT, { EURUSD: qt(1.1041, 1.1043) }, { continuous: true })
check('partial TP closes 50% at +30 pips (1.1031): 0.5*(1.1031-1.1001)*1e5 = +$150, keeps 0.5', t.events[0].type === 'ptp' && t.events[0].trade.pnl === 150 && t.ledger.positions[0].lots === 0.5 && t.ledger.positions[0].partialTp === null, JSON.stringify(t?.events[0]?.trade))
check('partial TP rejected when position too small', !!L.modifyPosition(L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 0.01 }, Q, 1).ledger, 'p1', { partialTp: { pips: 30, pct: 50 } }, Q).error)

// ── gap SL at order fill: continuous SL fills at level ──
let G = L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 1, sl: 1.098 }, Q, 1).ledger
check('candle replay: SL fills at the level 1.098 (−$210), not the low', L.processTick(G, { EURUSD: qt(1.0950, 1.0952) }, { continuous: true }).events[0].trade.pnl === -210)

// ── margin rejection at fill ──
const poor = L.createLedger(100, 100, 1)
let po = L.placeOrder(poor, { symbol: 'EURUSD', lots: 1, type: 'limit', side: 'buy', price: 1.095 }, Q, 1)
t = L.processTick(po.ledger, { EURUSD: qt(1.0939, 1.0941) })
check('fill without margin -> order rejected & removed, no position', t.events[0].type === 'rejected' && t.ledger.orders.length === 0 && t.ledger.positions.length === 0)

// ── offline catch-up ──
const quoteOf = (sym, mid, time) => { const h = I[sym].spread / 2; return { symbol: sym, time, bid: mid - h, ask: mid + h } }
const c = (time, open, high, low, close) => ({ time, open, high, low, close })
const run = (ledger, candles, startMid = 1.1) => L.catchUp(ledger, { candles: { EURUSD: candles }, startMids: { EURUSD: startMid }, quoteOf, from: 60 })
let CU = L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 1, sl: 1.098, tp: 1.103 }, Q, 1).ledger
let r = run(CU, [c(60, 1.1, 1.1005, 1.0995, 1.1), c(120, 1.1, 1.1045, 1.0970, 1.1)])
check('SL and TP both inside one candle -> SL FIRST (rule), marked approx', r.events.length === 1 && r.events[0].type === 'sl' && r.events[0].trade.approx === true, JSON.stringify(r.events.map((e) => e.type)))
r = run(CU, [c(60, 1.1, 1.1045, 1.1, 1.104)])
check('only TP reached -> TP at level 1.103', r.events[0].type === 'tp' && r.events[0].trade.exit === 1.103)
let CP = L.placeOrder(L0, { symbol: 'EURUSD', lots: 1, type: 'limit', side: 'buy', price: 1.095, sl: 1.09, tp: 1.105 }, Q, 1)
r = run(CP.ledger, [c(60, 1.1, 1.1, 1.0985, 1.099), c(120, 1.099, 1.0995, 1.0940, 1.095), c(180, 1.095, 1.1070, 1.0950, 1.106)])
check('pending order fills in candle 2, then TP in candle 3, in time order', r.events.map((e) => e.type).join() === 'fill,tp' && r.events[0].time < r.events[1].time, r.events.map((e) => e.type + '@' + e.time).join())
check('catch-up fill is approx + closed trade shows the profit', r.ledger.history[0].approx === true && r.ledger.history[0].pnl > 0)
r = run(CU, [c(60, 1.1, 1.1005, 1.0995, 1.1)])
check('quiet candles change nothing', r.events.length === 0 && r.ledger.positions.length === 1)
check('short SELL position: adverse extreme is the HIGH', (() => { const S = L.openPosition(L0, { symbol: 'EURUSD', side: 'sell', lots: 1, sl: 1.102, tp: 1.097 }, Q, 1).ledger; return run(S, [c(60, 1.1, 1.1025, 1.0965, 1.1)]).events[0].type === 'sl' })())

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
