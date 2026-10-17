// Phase 3: order checks, SL/TP, stop-out and a 20-trade balance reconciliation.
// Run: node tests/terminal-ledger.test.mjs
import './fixtures/legacyInstruments.js'
import { INSTRUMENTS as I } from '../src/lib/terminal/instruments.js'
import * as E from '../src/lib/terminal/engine.js'
import * as L from '../src/lib/terminal/ledger.js'

let fail = 0
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }
const qt = (bid, ask) => ({ bid, ask })

// ── entry/exit sides ──
check('BUY enters at ask, exits at bid', E.entryPrice('buy', qt(1, 2)) === 2 && E.exitPrice('buy', qt(1, 2)) === 1)
check('SELL enters at bid, exits at ask', E.entryPrice('sell', qt(1, 2)) === 1 && E.exitPrice('sell', qt(1, 2)) === 2)

// ── stop resolution ──
const r = (o) => E.resolveStop({ inst: I.EURUSD, lots: 1, entry: 1.1, ...o })
check('BUY SL 20 pips = 1.0980', r({ mode: 'pips', value: '20', kind: 'sl', side: 'buy' }).price === 1.098)
check('BUY TP 30 pips = 1.1030', r({ mode: 'pips', value: '30', kind: 'tp', side: 'buy' }).price === 1.103)
check('SELL SL 20 pips = 1.1020', r({ mode: 'pips', value: '20', kind: 'sl', side: 'sell' }).price === 1.102)
check('SELL TP 30 pips = 1.0970', r({ mode: 'pips', value: '30', kind: 'tp', side: 'sell' }).price === 1.097)
check('BUY SL $100 on 1 lot EURUSD = 10 pips = 1.0990', r({ mode: 'usd', value: '100', kind: 'sl', side: 'buy' }).price === 1.099)
check('BUY SL $100 on 0.5 lot = 20 pips = 1.0980', r({ mode: 'usd', value: '100', kind: 'sl', side: 'buy', lots: 0.5 }).price === 1.098)
check('price mode passthrough', r({ mode: 'price', value: '1.0950', kind: 'sl', side: 'buy' }).price === 1.095)
check('empty = no stop', r({ mode: 'pips', value: '', kind: 'sl', side: 'buy' }).price === null)
check('garbage rejected', !!r({ mode: 'pips', value: 'abc', kind: 'sl', side: 'buy' }).error)

// ── stop side validation ──
const q0 = qt(1.0999, 1.1001)
check('BUY SL below bid ok', E.validateStops('buy', q0, 1.098, 1.102, I.EURUSD) === null)
check('BUY SL above bid rejected', !!E.validateStops('buy', q0, 1.1, null, I.EURUSD))
check('BUY TP below bid rejected', !!E.validateStops('buy', q0, null, 1.099, I.EURUSD))
check('SELL SL below ask rejected', !!E.validateStops('sell', q0, 1.1, null, I.EURUSD))
check('SELL TP below ask ok', E.validateStops('sell', q0, 1.102, 1.098, I.EURUSD) === null)

// ── order evaluation: balance 10000, 1:100, EURUSD @1.1 ──
const L0 = L.createLedger(10000, 100, 1000)
const m0 = L.metricsFor(L0, {})
const evOk = E.evaluateOrder({ side: 'buy', lots: 1, quote: qt(1.0999, 1.1001), inst: I.EURUSD, leverage: 100, metrics: m0 })
check('1 lot EURUSD margin = $1100.10, free after = 8899.90', near(evOk.margin, 1100.1, 0.001) && near(evOk.freeAfter, 8899.9, 0.001) && !evOk.error)
const evBig = E.evaluateOrder({ side: 'buy', lots: 10, quote: qt(1.0999, 1.1001), inst: I.EURUSD, leverage: 100, metrics: m0 })
check('10 lots blocked: not enough margin', /Not enough margin/.test(evBig.error || ''), evBig.error)
check('bad lots blocked', !!E.evaluateOrder({ side: 'buy', lots: 0.005, quote: q0, inst: I.EURUSD, leverage: 100, metrics: m0 }).error)
check('1:1 leverage blocks 1 lot', !!E.evaluateOrder({ side: 'buy', lots: 1, quote: q0, inst: I.EURUSD, leverage: 1, metrics: m0 }).error)

// ── open / close ──
let Q = { EURUSD: qt(1.0999, 1.1001) }
let o = L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 1 }, Q, 1000)
check('BUY opens at ask 1.1001', !o.error && o.position.entry === 1.1001)
Q = { EURUSD: qt(1.1099, 1.1101) } // +100 pips on the bid
let c = L.closePosition(o.ledger, o.position.id, Q, { now: 2000 })
check('close at bid: (1.1099-1.1001)*100000 = +$980', c.trade.pnl === 980 && c.ledger.account.balance === 10980, JSON.stringify(c.trade))
check('history records reason manual & pips 98', c.trade.reason === 'manual' && c.trade.pips === 98)
check('position removed after full close', c.ledger.positions.length === 0)

// ── partial close ──
o = L.openPosition(L0, { symbol: 'EURUSD', side: 'sell', lots: 0.5 }, { EURUSD: qt(1.0999, 1.1001) }, 1)
const pc = L.partialClose(o.ledger, o.position.id, 50, { EURUSD: qt(1.0949, 1.0951) })
check('SELL 0.5 @1.0999, 50% closed @ask 1.0951: 0.25*(1.0999-1.0951)*100000 = +$120', pc.trade.pnl === 120 && pc.ledger.positions[0].lots === 0.25, JSON.stringify(pc.trade))
check('partial of 0.01 lot refused', !!L.partialClose(L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 0.01 }, { EURUSD: q0 }, 1).ledger, 'p1', 50, { EURUSD: q0 }).error)

// ── reverse ──
o = L.openPosition(L0, { symbol: 'XAUUSD', side: 'buy', lots: 0.1 }, { XAUUSD: qt(2000, 2000.3) }, 1)
const rv = L.reversePosition(o.ledger, o.position.id, { XAUUSD: qt(2010, 2010.3) }, 2)
check('reverse: BUY closed at bid 2010 (+0.1*100*9.7=$97) and SELL opened @2010', rv.trade.pnl === 97 && rv.ledger.positions.length === 1 && rv.ledger.positions[0].side === 'sell' && rv.ledger.positions[0].entry === 2010, JSON.stringify(rv.trade))

// ── SL / TP on tick ──
o = L.openPosition(L0, { symbol: 'EURUSD', side: 'buy', lots: 1, sl: 1.098, tp: 1.103 }, { EURUSD: qt(1.0999, 1.1001) }, 1)
check('no trigger inside the range', L.processTick(o.ledger, { EURUSD: qt(1.1, 1.1002) }) === null)
let t = L.processTick(o.ledger, { EURUSD: qt(1.0979, 1.0981) })
check('BUY SL fires on BID <= SL, fills at the quote (gap-aware): (1.0979-1.1001)*1e5 = -$220', t.events[0].type === 'sl' && t.events[0].trade.pnl === -220 && t.ledger.positions.length === 0, JSON.stringify(t?.events))
t = L.processTick(o.ledger, { EURUSD: qt(1.1031, 1.1033) })
check('BUY TP fires on BID >= TP: +$300', t.events[0].type === 'tp' && t.events[0].trade.pnl === 300)
o = L.openPosition(L0, { symbol: 'EURUSD', side: 'sell', lots: 1, sl: 1.102, tp: 1.097 }, { EURUSD: qt(1.0999, 1.1001) }, 1)
check('SELL triggers on ASK (not bid)', L.processTick(o.ledger, { EURUSD: qt(1.1021, 1.1023) }).events[0].type === 'sl' && L.processTick(o.ledger, { EURUSD: qt(1.0968, 1.0970) }).events[0].type === 'tp')
check('SELL: bid below SL but ask not → no trigger', L.processTick(o.ledger, { EURUSD: qt(1.1017, 1.1019) }) === null)

// ── stop-out: balance 2000, two EURUSD-ish positions ──
let S = L.createLedger(2000, 100, 1)
const Q1 = { EURUSD: qt(1.0999, 1.1001), XAUUSD: qt(2000, 2000.3) }
S = L.openPosition(S, { symbol: 'EURUSD', side: 'buy', lots: 1 }, Q1, 1).ledger // margin ≈ 1100
S = L.openPosition(S, { symbol: 'XAUUSD', side: 'buy', lots: 0.01 }, Q1, 1).ledger // margin ≈ 20
// EURUSD −60 pips → −$600 − spread; equity ≈ 1400, margin ≈ 1120 → 125%: no stop-out
check('no stop-out at ~125%', L.processTick(S, { EURUSD: qt(1.0939, 1.0941), XAUUSD: qt(2000, 2000.3) }) === null)
// EURUSD −100 pips → equity ≈ 1000 / 1120 → ~89% (margin call zone, still open)
const mcl = L.metricsFor(S, { EURUSD: qt(1.0899, 1.0901), XAUUSD: qt(2000, 2000.3) })
check('margin call zone (<100%) still open', mcl.marginLevel < 100 && mcl.marginLevel > 50, String(mcl.marginLevel))
// EURUSD −130 pips: equity ≈ 700 / 1120 → 62% ... −160 → 400/1120 → 36% → stop-out
const so = L.processTick(S, { EURUSD: qt(1.0839, 1.0841), XAUUSD: qt(2000, 2000.3) })
check('stop-out closes worst loser (EURUSD) first', so && so.events[0].type === 'stopout' && so.events[0].trade.symbol === 'EURUSD', JSON.stringify(so?.events.map((e) => e.trade.symbol)))
check('after stop-out margin level ≥ 50% (or flat)', (() => { const m = L.metricsFor(so.ledger, { EURUSD: qt(1.0839, 1.0841), XAUUSD: qt(2000, 2000.3) }); return m.marginLevel == null || m.marginLevel >= 50 })())

// ── per-position leverage is remembered ──
let LV = L.createLedger(10000, 100, 1)
LV = L.openPosition(LV, { symbol: 'EURUSD', side: 'buy', lots: 1 }, { EURUSD: q0 }, 1).ledger
LV = { ...LV, account: { ...LV.account, leverage: 500 } }
check('changing leverage later does not change old margin', near(L.metricsFor(LV, { EURUSD: q0 }).usedMargin, 1100.1, 0.001))

// ── 20-trade reconciliation vs hand arithmetic ──
let R = L.createLedger(10000, 100, 1)
let expected = 10000
const spec = [
  ['EURUSD', 'buy', 0.5, 1.1, 1.103], ['EURUSD', 'sell', 0.3, 1.1, 1.097], ['GBPUSD', 'buy', 0.2, 1.3, 1.296], ['GBPUSD', 'sell', 0.4, 1.3, 1.305],
  ['XAUUSD', 'buy', 0.1, 2000, 2012.5], ['XAUUSD', 'sell', 0.2, 2000, 1995], ['USDJPY', 'buy', 0.3, 150, 150.4], ['USDJPY', 'sell', 0.2, 150, 149.2],
  ['GBPJPY', 'buy', 0.1, 200, 201.1], ['GBPJPY', 'sell', 0.1, 200, 199.0], ['NIFTY50', 'buy', 1, 22500, 22560], ['NIFTY50', 'sell', 0.5, 22500, 22530],
  ['EURUSD', 'buy', 0.07, 1.1, 1.0985], ['EURUSD', 'sell', 0.13, 1.1, 1.0991], ['XAUUSD', 'buy', 0.03, 2000, 1990], ['XAUUSD', 'sell', 0.06, 2000, 2001],
  ['USDJPY', 'buy', 0.5, 150, 149.5], ['GBPUSD', 'buy', 0.15, 1.3, 1.3022], ['NIFTY50', 'buy', 0.2, 22500, 22450], ['GBPJPY', 'sell', 0.25, 200, 199.6],
]
const rate = { USDJPY: 150, USDINR: 83 }
for (const [sym, side, lots, price, exitMid] of spec) {
  const inst = I[sym]
  const half = inst.spread / 2
  const open = { [sym]: qt(price - half, price + half) }
  const o2 = L.openPosition(R, { symbol: sym, side, lots }, open, 1)
  if (o2.error) { check(`trade ${sym} opened`, false, o2.error); continue }
  const close = { [sym]: qt(exitMid - half, exitMid + half) }
  const c2 = L.closePosition(o2.ledger, o2.position.id, close, { now: 2 })
  R = c2.ledger
  const entry = side === 'buy' ? price + half : price - half
  const exit = side === 'buy' ? exitMid - half : exitMid + half
  const conv = sym === 'USDJPY' || sym === 'GBPJPY' ? 1 / rate.USDJPY : sym === 'NIFTY50' ? 1 / rate.USDINR : 1
  const raw = (side === 'buy' ? 1 : -1) * (exit - entry) * lots * inst.contractSize * conv
  expected += Math.round(raw * 100) / 100
}
check(`20 trades: ledger balance ${R.account.balance} == hand-calculated ${expected.toFixed(2)}`, R.history.length === 20 && near(R.account.balance, expected, 0.001))
check('20 trades: balance = start + Σ history pnl', near(R.account.balance, 10000 + R.history.reduce((a, h) => a + h.pnl, 0), 0.001))
check('20 trades: flat account → equity == balance', L.metricsFor(R, {}).equity === R.account.balance && R.positions.length === 0)

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
