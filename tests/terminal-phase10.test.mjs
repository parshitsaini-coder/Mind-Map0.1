// Phase 10 (on-chart position management): P/L figures + tags, drag validation matrix, snapping,
// break-even magnet, default SL/TP distances, custom partial close, margin state, undo stack, pill spreading,
// settings defaults, and "overlay number == ledger number" for forex, gold, JPY and index.
// Run through ./tests/run.sh (it imports the ledger).
import * as O from '../src/lib/terminal/chartOrders.js'
import * as E from '../src/lib/terminal/engine.js'
import * as L from '../src/lib/terminal/ledger.js'
import * as C from '../src/lib/terminal/chartSettings.js'
import { INSTRUMENTS } from '../src/lib/terminal/instruments.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t
const EU = INSTRUMENTS.EURUSD, XA = INSTRUMENTS.XAUUSD, JP = INSTRUMENTS.USDJPY, NI = INSTRUMENTS.NIFTY50

// ── P/L figures ──
const f = O.plFigures({ side: 'buy', lots: 1, from: 1.1600, to: 1.1630, inst: EU, balance: 10000, riskPrice: 1.1585 })
check('plFigures buy: money / pips / % / R', near(f.money, 300, 1e-6) && near(f.pips, 30, 1e-6) && near(f.percent, 3, 1e-9) && near(f.r, 2, 1e-9), JSON.stringify(f))
const fs = O.plFigures({ side: 'sell', lots: 0.5, from: 1.16, to: 1.1630, inst: EU, balance: 10000, riskPrice: 1.1640 })
check('plFigures sell loses when price rises; R is negative', fs.money < 0 && near(fs.money, -150, 1e-6) && fs.r < 0)
check('R is null without a stop', O.plFigures({ side: 'buy', lots: 1, from: 1.16, to: 1.17, inst: EU, balance: 1 }).r === null)
check('percent is 0 with no balance (no NaN)', O.plFigures({ side: 'buy', lots: 1, from: 1.16, to: 1.17, inst: EU, balance: 0 }).percent === 0)
check('fmtFigure money has sign + grouping', O.fmtFigure({ money: 1234.5 }, 'money') === '+$1,234.50' && O.fmtFigure({ money: -45 }, 'money') === '−$45.00')
check('fmtFigure zero is "+"', O.fmtFigure({ money: 0 }, 'money') === '+$0.00')
check('fmtFigure pips / % / R / points', O.fmtFigure({ pips: -15 }, 'pips') === '−15.0 pips' && O.fmtFigure({ percent: 0.9 }, 'percent') === '+0.90%' && O.fmtFigure({ r: 2 }, 'r') === '+2.00 R' && O.fmtFigure({ r: null }, 'r') === 'R —' && O.fmtFigure({ points: 123.4 }, 'points') === '+123 pts')
const sl = O.levelTag('SL', O.plFigures({ side: 'buy', lots: 0.3, from: 1.1600, to: 1.1585, inst: EU, balance: 10000 }))
check('SL tag text', sl === 'SL −$45.00 (−15.0 pips) −0.45 %', sl)
const tp = O.levelTag('TP', O.plFigures({ side: 'buy', lots: 0.3, from: 1.1600, to: 1.1630, inst: EU, balance: 10000, riskPrice: 1.1585 }))
check('TP tag text carries R', tp === 'TP +$90.00 (+30.0 pips) +0.90 % R 2.0', tp)
check('plUnit cycle: money → pips → percent → r → money', O.nextPlUnit('money') === 'pips' && O.nextPlUnit('pips') === 'percent' && O.nextPlUnit('percent') === 'r' && O.nextPlUnit('r') === 'money' && O.nextPlUnit('points') === 'money')

// ── overlay number == ledger number (forex, gold, JPY, index) ──
for (const [sym, inst, entry, move] of [['EURUSD', EU, 1.16, 0.0042], ['XAUUSD', XA, 4350, 12.3], ['USDJPY', JP, 150, 0.37], ['NIFTY50', NI, 22500, 61]]) {
  for (const side of ['buy', 'sell']) {
    const lots = sym === 'NIFTY50' ? 0.3 : 0.37
    let led = L.createLedger(100000, 100)
    const q0 = { bid: entry - inst.spread / 2, ask: entry + inst.spread / 2 }
    const o = L.openPosition(led, { symbol: sym, side, lots }, { [sym]: q0 })
    led = o.ledger
    const exitQ = { bid: +(entry + (side === 'buy' ? move : -move) - inst.spread / 2).toFixed(inst.digits), ask: +(entry + (side === 'buy' ? move : -move) + inst.spread / 2).toFixed(inst.digits) }
    const px = E.exitPrice(side, exitQ)
    const chip = O.plFigures({ side, lots, from: o.position.entry, to: px, inst, balance: led.account.balance }).money
    const closed = L.closePosition(led, o.position.id, { [sym]: exitQ })
    check(`overlay P/L == closed-trade P/L: ${sym} ${side}`, near(Math.round(chip * 100) / 100, closed.trade.pnl, 0.005), `${chip} vs ${closed.trade.pnl}`)
  }
}

// ── drag validation matrix (the engine's own rules) ──
const q = { bid: 1.1600, ask: 1.1601 }
const posB = { side: 'buy', entry: 1.1601, lots: 1 }, posS = { side: 'sell', entry: 1.16, lots: 1 }
const v = (kind, price, pos, order) => O.validateDrag({ kind, price, pos, order, q, inst: EU })
check('BUY: SL below price ok / above rejected', v('sl', 1.1580, posB) === null && /below/.test(v('sl', 1.1620, posB)))
check('BUY: TP above ok / below rejected', v('tp', 1.1650, posB) === null && /above/.test(v('tp', 1.1580, posB)))
check('SELL: SL above ok / below rejected', v('sl', 1.1620, posS) === null && /above/.test(v('sl', 1.1580, posS)))
check('SELL: TP below ok / above rejected', v('tp', 1.1550, posS) === null && /below/.test(v('tp', 1.1650, posS)))
check('invalid / NaN / no quote / off-chart', /off the chart/.test(v('sl', NaN, posB)) && /off the chart/.test(v('sl', -1, posB)) && /Waiting/.test(O.validateDrag({ kind: 'sl', price: 1.1, pos: posB, q: null, inst: EU })))
const lim = { type: 'limit', side: 'buy', price: 1.1550, lots: 1 }
check('pending: buy limit must be below ask', v('order', 1.1560, posB, lim) === null && /below/.test(v('order', 1.1700, posB, lim)))
const stp = { type: 'stop', side: 'sell', price: 1.1550, lots: 1 }
check('pending: sell stop must be below bid', v('order', 1.1500, posB, stp) === null && /below/.test(v('order', 1.1700, posB, stp)))
const sli = { type: 'stoplimit', side: 'buy', price: 1.1700, limitPrice: 1.1690, lots: 1 }
check('pending stop-limit: limit leg below stop', v('limit', 1.1680, posB, sli) === null && /below the stop/.test(v('limit', 1.1750, posB, sli)))
check("pending's SL / TP are checked against the order price", v('osl', 1.1540, posB, lim) === null && /below/.test(v('osl', 1.1560, posB, lim)) && v('otp', 1.1600, posB, lim) === null && /above/.test(v('otp', 1.1500, posB, lim)))

// ── snapping ──
const sn = (p, o) => O.snapPrice(p, { inst: EU, ...o })
check('snap off leaves the price (rounded to digits)', sn(1.158437, {}) === 1.15844)
check('snap round = 10 pips', sn(1.15843, { mode: 'round' }) === 1.158 && sn(1.15861, { mode: 'round' }) === 1.159)
check('Shift = one tick, Ctrl = 10 pips (override the mode)', sn(1.1584349, { fine: true }) === 1.15843 && sn(1.15843, { coarse: true }) === 1.158)
check('snap to bars: nearest level within tolerance, else raw', sn(1.1589, { mode: 'bars', levels: [1.1590, 1.1700], tol: 0.0003 }) === 1.159 && sn(1.1600, { mode: 'bars', levels: [1.1590, 1.1700], tol: 0.0003 }) === 1.16)
check('snap to bars picks the CLOSEST of two', sn(1.15905, { mode: 'bars', levels: [1.1590, 1.1593], tol: 0.001 }) === 1.159)
check('gold snaps with its own pip (0.1 → 1.0)', O.snapPrice(4351.37, { inst: XA, mode: 'round' }) === 4351)
check('barLevels = highs and lows of the last n bars', JSON.stringify(O.barLevels([{ high: 3, low: 1 }, { high: 5, low: 2 }, { high: 4, low: 0 }], 2)) === JSON.stringify([5, 2, 4, 0]))

// ── break-even magnet ──
check('SL near entry clicks onto entry; far one does not', O.breakEvenSnap(1.16008, 1.1601, EU) === 1.1601 && O.breakEvenSnap(1.1590, 1.1601, EU) === 1.1590)
check('break-even zone edge (1.5 pips) is inclusive', O.breakEvenSnap(1.1601 - 0.00015, 1.1601, EU) === 1.1601)

// ── default SL / TP ──
const ds = (o) => O.defaultStop({ entry: 1.16, inst: EU, ...o })
check('default stop in pips: BUY SL below / TP above', ds({ kind: 'sl', side: 'buy', unit: 'pips', value: 20 }).price === 1.158 && ds({ kind: 'tp', side: 'buy', unit: 'pips', value: 40 }).price === 1.164)
check('default stop in pips: SELL mirrored', ds({ kind: 'sl', side: 'sell', unit: 'pips', value: 20 }).price === 1.162 && ds({ kind: 'tp', side: 'sell', unit: 'pips', value: 40 }).price === 1.156)
check('default stop in % of price', ds({ kind: 'sl', side: 'buy', unit: 'percent', value: 0.5 }).price === 1.1542)
check('default stop in ATR multiples (needs an ATR)', ds({ kind: 'sl', side: 'buy', unit: 'atr', value: 2, atr: 0.001 }).price === 1.158 && /ATR/.test(ds({ kind: 'sl', side: 'buy', unit: 'atr', value: 2, atr: null }).error))
check('default stop rejects zero distance / unknown unit', !!ds({ kind: 'sl', side: 'buy', unit: 'pips', value: 0 }).error && !!ds({ kind: 'sl', side: 'buy', unit: 'furlongs', value: 1 }).error)
const bars = Array.from({ length: 20 }, (_, i) => ({ high: 11 + i * 0, low: 9, close: 10 }))
check('atrOf = mean true range; null when too few bars', near(O.atrOf(bars, 14), 2) && O.atrOf(bars.slice(0, 5), 14) === null)

// ── custom partial close ──
check('close lots: ok / whole / too small remainder / bad step / zero', O.validateCloseLots(1, 0.4, EU) === null && /whole/.test(O.validateCloseLots(1, 1, EU)) && /stay open/.test(O.validateCloseLots(0.015, 0.01, { ...EU, minLot: 0.01, lotStep: 0.005 })) && /step/i.test(O.validateCloseLots(1, 0.333, EU)) && !!O.validateCloseLots(1, 0, EU))

// ── margin state ──
check('margin state: none / ok / warn / danger (boundaries)', O.marginState(null, 100, 50) === 'none' && O.marginState(500, 100, 50) === 'ok' && O.marginState(100, 100, 50) === 'ok' && O.marginState(99.9, 100, 50) === 'warn' && O.marginState(50, 100, 50) === 'warn' && O.marginState(49.9, 100, 50) === 'danger')

// ── undo stack ──
const u = O.createUndo(3)
for (let i = 1; i <= 4; i++) u.push({ id: `e${i}` }, 1000 + i)
check('undo stack keeps only the last N and pops newest first', u.size() === 3 && u.pop().id === 'e4' && u.pop().id === 'e3' && u.size() === 1)
u.drop('e2')
check('undo drop removes an entry; pop on empty is null', u.size() === 0 && u.pop() === null)

// ── pill spreading ──
const sp = O.spreadY([{ y: 100 }, { y: 102 }, { y: 104 }], 30, 0, 500)
check('overlapping pills are spread >= gap apart, order kept', sp[1].ry - sp[0].ry >= 30 && sp[2].ry - sp[1].ry >= 30 && sp[0].y === 100)
const sp2 = O.spreadY([{ y: 490 }, { y: 495 }, { y: 498 }], 30, 0, 500)
check('a stack at the bottom is pulled back up inside the chart', sp2[2].ry <= 500 && sp2[1].ry <= 470 && sp2[0].ry <= 440)
check('well separated pills stay put', (() => { const r = O.spreadY([{ y: 50 }, { y: 300 }], 30, 0, 500); return r[0].ry === 50 && r[1].ry === 300 })())

// ── settings: defaults, validation, old saves ──
const D = C.DEFAULT_CHART_SETTINGS.trading
check('Phase 10 defaults exist', D.showPlPill === true && D.reverseBtn === true && D.extendLines === true && D.snap === 'off' && D.defSlUnit === 'pips' && D.defSlValue === 20 && D.defTpValue === 40 && D.marginWarn === 100)
const cl = C.cleanChartSettings({ trading: { snap: 'magic', defSlUnit: 'x', defSlValue: -5, defTpValue: 1e9, marginWarn: 1, plUnit: 'r', showPlPill: 'yes' } }).trading
check('Phase 10 settings are validated (enum / range / bool)', cl.snap === 'off' && cl.defSlUnit === 'pips' && cl.defSlValue === 0.1 && cl.defTpValue === 10000 && cl.marginWarn === 50 && cl.plUnit === 'r' && cl.showPlPill === true)
check('an old save without the new keys loads with defaults', (() => { const o = C.cleanChartSettings({ trading: { plUnit: 'pips', colorBuy: '#112233' } }).trading; return o.plUnit === 'pips' && o.colorBuy === '#112233' && o.snap === 'off' && o.marginWarn === 100 })())

// ── ledger: modify keeps a small event log ──
{
  let led = L.createLedger(10000, 100)
  const qq = { EURUSD: { bid: 1.16, ask: 1.1601 } }
  led = L.openPosition(led, { symbol: 'EURUSD', side: 'buy', lots: 0.5 }, qq).ledger
  const id = led.positions[0].id
  led = L.modifyPosition(led, id, { sl: 1.158 }, qq).ledger
  led = L.modifyPosition(led, id, { sl: 1.1585, tp: 1.165 }, qq).ledger
  const p = led.positions[0]
  check('modify logs each changed level (from → to)', p.log.length === 3 && p.log[0].ev === 'sl' && p.log[0].from === null && p.log[0].to === 1.158 && p.log[1].from === 1.158 && p.log[2].ev === 'tp')
  const same = L.modifyPosition(led, id, { sl: 1.1585 }, qq).ledger.positions[0]
  check('re-setting the same level logs nothing', same.log.length === 3)
  const many = (() => { let l = led; for (let i = 0; i < 40; i++) l = L.modifyPosition(l, id, { sl: 1.15 + i * 0.0001 }, qq).ledger; return l.positions[0].log.length })()
  check('event log is capped at 30', many === 30)
  const rej = L.modifyPosition(led, id, { sl: 1.17 }, qq)
  check('invalid modify is rejected with a reason and changes nothing', !!rej.error && rej.ledger === undefined)
}

process.exit(fail ? 1 : 0)
