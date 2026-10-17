// Phase 5: statistics, filters, CSV, deposits/withdrawals/reset, journal bridge.
// Run: node tests/terminal-stats.test.mjs
import './fixtures/legacyInstruments.js'
import * as L from '../src/lib/terminal/ledger.js'
import * as S from '../src/lib/terminal/stats.js'
import * as J from '../src/lib/terminal/journal.js'
import { INSTRUMENTS as I } from '../src/lib/terminal/instruments.js'
import { FOREX_PAIRS, INDICES, COMMODITIES } from '../src/data/instruments.js'

let fail = 0
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol
const T = (n, sym, side, pnl, o = 0, c = 600, extra = {}) => ({ id: `h${n}`, symbol: sym, side, lots: 0.1, entry: 1.1, exit: 1.101, sl: null, tp: null, openTime: 1000 + o, closeTime: 1000 + c, pnl, pips: pnl / 10, reason: 'manual', ...extra })

// ── statistics, hand-checked: P&L +100 −50 +200 −100 0 +50, start $10,000 ──
const hist = [
  T(1, 'EURUSD', 'buy', 100, 0, 600), T(2, 'EURUSD', 'sell', -50, 700, 1300), T(3, 'XAUUSD', 'buy', 200, 1400, 2000),
  T(4, 'XAUUSD', 'sell', -100, 2100, 2700), T(5, 'GBPUSD', 'buy', 0, 2800, 3400), T(6, 'EURUSD', 'buy', 50, 3500, 4100),
].reverse() // history is stored newest-first
const s = S.statsFor(hist, 10000)
check('counts: 6 trades = 3 wins + 2 losses + 1 breakeven', s.trades === 6 && s.wins === 3 && s.losses === 2 && s.breakeven === 1)
check('net P&L = +200, gross profit 350, gross loss −150', s.net === 200 && s.grossProfit === 350 && s.grossLoss === -150)
check('win rate = 3/6 = 50%', near(s.winRate, 50))
check('profit factor = 350/150 = 2.3333', near(s.profitFactor, 350 / 150))
check('avg win 116.67 · avg loss −75 · payoff 1.5556 · expectancy 33.33', near(s.avgWin, 350 / 3) && s.avgLoss === -75 && near(s.payoff, (350 / 3) / 75) && near(s.expectancy, 200 / 6))
check('best +200 / worst −100', s.best.pnl === 200 && s.worst.pnl === -100)
check('equity curve 10000→10100→10050→10250→10150→10150→10200', s.curve.map((p) => p.balance).join() === '10000,10100,10050,10250,10150,10150,10200')
check('max drawdown = 10250 − 10150 = $100 = 0.9756%', s.maxDrawdown === 100 && near(s.maxDrawdownPct, (100 / 10250) * 100) && s.currentDrawdown === 50, `${s.maxDrawdown} ${s.maxDrawdownPct} ${s.currentDrawdown}`)
check('streaks (flat trade resets both): best win run 1, loss run 1', s.winStreak === 1 && s.lossStreak === 1)
check('avg duration = 600 s', s.avgDurationSec === 600 && S.fmtDuration(600) === '10m' && S.fmtDuration(45) === '45s' && S.fmtDuration(3725) === '1h 2m')
check('per symbol: EURUSD 3 trades net +100, XAUUSD net +100, GBPUSD flat', s.bySymbol.EURUSD.trades === 3 && s.bySymbol.EURUSD.net === 100 && s.bySymbol.XAUUSD.net === 100 && s.bySymbol.GBPUSD.net === 0 && s.bySymbol.XAUUSD.profitFactor === 2)
const run = S.statsFor([T(1, 'EURUSD', 'buy', 10), T(2, 'EURUSD', 'buy', 20, 700, 1300), T(3, 'EURUSD', 'buy', -5, 1400, 2000), T(4, 'EURUSD', 'buy', 5, 2100, 2700)], 1000)
check('drawdown counts peak-to-trough on a rising curve (1030 → 1025 = $5)', run.maxDrawdown === 5 && run.endBalance === 1030)
const e = S.statsFor([], 5000)
check('empty history: nothing crashes, metrics are null', e.trades === 0 && e.winRate === null && e.profitFactor === null && e.best === null && e.curve.length === 1 && e.curve[0].balance === 5000)
check('no losses → profit factor ∞', S.statsFor([T(1, 'EURUSD', 'buy', 30)], 100).profitFactor === Infinity)
check('only losses → profit factor 0', S.statsFor([T(1, 'EURUSD', 'buy', -30)], 100).profitFactor === 0)

// ── filters ──
const NOW = 100000
const mix = [
  T(1, 'EURUSD', 'buy', 50, 0, NOW - 100, { reason: 'tp' }), T(2, 'XAUUSD', 'sell', -20, 0, NOW - 3 * 86400, { reason: 'sl' }),
  T(3, 'EURUSD', 'sell', -10, 0, NOW - 20 * 86400, { reason: 'manual' }), T(4, 'GBPUSD', 'buy', 0, 0, NOW - 40 * 86400, { reason: 'stopout' }),
]
const ids = (f) => S.filterTrades(mix, f, NOW).map((t) => t.id).join()
check('filter by symbol', ids({ symbol: 'EURUSD' }) === 'h1,h3')
check('filter by side', ids({ side: 'sell' }) === 'h2,h3')
check('filter by result win / loss / flat', ids({ result: 'win' }) === 'h1' && ids({ result: 'loss' }) === 'h2,h3' && ids({ result: 'flat' }) === 'h4')
check('filter by reason', ids({ reason: 'sl' }) === 'h2' && ids({ reason: 'stopout' }) === 'h4')
check('filter by period 7d / 30d (today = since local midnight)', ids({ period: '7d' }) === 'h1,h2' && ids({ period: '30d' }) === 'h1,h2,h3' && ids({ period: 'all' }) === 'h1,h2,h3,h4')
check('filters combine (AND)', ids({ symbol: 'EURUSD', result: 'loss' }) === 'h3' && ids({ symbol: 'all', side: 'all', result: 'all', reason: 'all' }) === 'h1,h2,h3,h4')

// ── CSV ──
const csv = S.toCsv([T(2, 'XAUUSD', 'sell', -20, 0, 120, { sl: 4400, tp: null, reason: 'sl', approx: true, entry: 4350.5, exit: 4352.5 }), T(1, 'EURUSD', 'buy', 50.25, 0, 60, { exit: 1.1005 })])
const lines = csv.trim().split('\r\n')
check('CSV: header + one row per trade, oldest first, CRLF', lines.length === 3 && lines[0].startsWith('id,symbol,side,lots,open_time_utc') && lines[1].startsWith('h1,EURUSD,buy,0.1,') && lines[2].startsWith('h2,XAUUSD,sell'))
check('CSV: pnl/pips/duration/reason/approx columns', lines[1].endsWith(',5.025,50.25,1,Manual,no') && lines[2].includes(',-20,') && lines[2].endsWith(',Stop loss,yes'), lines[2])
check('CSV: ISO UTC times', /1970-01-01T00:16:40\.000Z/.test(lines[1]))
const q = S.toCsv([T(1, 'EURUSD', 'buy', 1, 0, 60, { reason: 'we,ird "x"' })])
check('CSV: commas and quotes are escaped', q.includes('"we,ird ""x"""'))

// ── deposit / withdraw / reset ──
const base = L.createLedger(10000, 100, 1000)
let d = L.deposit(base, 2500.556, 1001)
check('deposit adds to balance + records a transaction (rounded to cents)', d.ledger.account.balance === 12500.56 && d.ledger.transactions[0].type === 'deposit' && d.ledger.transactions[0].amount === 2500.56 && d.ledger.transactions[0].balanceAfter === 12500.56)
check('deposit rejects 0, negatives, NaN, > limit', !!L.deposit(base, 0).error && !!L.deposit(base, -5).error && !!L.deposit(base, 'abc').error && !!L.deposit(base, 2e8).error)
let w = L.withdraw(base, 400, {}, 1002)
check('withdraw subtracts + records', w.ledger.account.balance === 9600 && w.ledger.transactions[0].type === 'withdraw')
check('cannot withdraw more than the balance', !!L.withdraw(base, 10000.01, {}).error)
const Q = { EURUSD: { bid: 1.0999, ask: 1.1001 } }
const op = L.openPosition(base, { symbol: 'EURUSD', side: 'buy', lots: 1 }, Q, 1000) // margin 1100.10
const wm = L.withdraw(op.ledger, 9000, Q)
check('cannot withdraw margin that is in use (free margin ≈ 8899.9 − floating loss)', !!wm.error && /at most/.test(wm.error), wm.error)
check('…but can withdraw within free margin', !L.withdraw(op.ledger, 8000, Q).error)
check('deposit/withdraw do not touch the trade history or stats', d.ledger.history.length === 0 && S.statsFor(d.ledger.history, 10000).trades === 0)
const rs = L.resetLedger(25000, 50, 5000)
check('reset: fresh account at the new starting balance & leverage, everything wiped', rs.ledger.account.balance === 25000 && rs.ledger.account.startBalance === 25000 && rs.ledger.account.leverage === 50 && rs.ledger.positions.length === 0 && rs.ledger.history.length === 0 && rs.ledger.transactions.length === 0 && rs.ledger.nextId === 1)
check('reset validation: too small / too big / bad leverage', !!L.resetLedger(5).error && !!L.resetLedger(5e8).error && !!L.resetLedger(1000, 77).error && !!L.resetLedger('x').error)

// ── tf / SL / TP are recorded on the closed trade ──
const o2 = L.openPosition(base, { symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.09, tp: 1.12, tf: 'H1' }, Q, 1000)
const c2 = L.closePosition(o2.ledger, o2.position.id, { EURUSD: { bid: 1.1049, ask: 1.1051 } }, { now: 2000 })
check('closed trade carries sl, tp and the chart timeframe it was opened on', c2.trade.sl === 1.09 && c2.trade.tp === 1.12 && c2.trade.tf === 'H1')
const pl = L.placeOrder(base, { symbol: 'EURUSD', lots: 0.1, type: 'limit', side: 'buy', price: 1.095, tf: 'M5' }, Q, 1000)
const fl = L.processTick(pl.ledger, { EURUSD: { bid: 1.0948, ask: 1.0950 } }, { now: 1001 })
check('a filled pending order passes its timeframe on to the position', fl.ledger.positions[0].tf === 'M5')

// ── journal bridge ──
const taKeys = ['name', 'date', 'pair', 'instrumentName', 'instrumentType', 'timeframe', 'setupTypes', 'direction', 'price', 'pnl', 'notes', 'validationRuleIds', 'validationScore', 'screenshotUrl', 'screenshotHosted', 'resultImageUrl', 'resultImageHosted', 'status', 'createdAt']
const lists = { Forex: FOREX_PAIRS, Index: INDICES, Commodity: COMMODITIES }
for (const sym of Object.keys(I)) {
  const m = J.TA_INSTRUMENT_MAP[sym]
  check(`${sym} → Trade Analysis "${m?.pair}" exists in its ${m?.type} list`, !!m && lists[m.type].some((x) => x.symbol === m.pair))
}
const jt = T(7, 'EURUSD', 'buy', 125.5, 0, 3600, { entry: 1.1, exit: 1.1126, sl: 1.095, tp: 1.115, pips: 126, reason: 'tp', tf: 'H1', closeTime: Math.floor(new Date(2026, 9, 12, 15, 30).getTime() / 1000) })
const je = J.toJournalEntry(jt)
check('entry uses only fields Trade Analysis already has', Object.keys(je).every((k) => taKeys.includes(k)) && taKeys.every((k) => k in je))
check('pair/type/direction/timeframe/price/pnl/date map correctly', je.pair === 'EUR/USD' && je.instrumentType === 'Forex' && je.direction === 'Buy' && je.timeframe === '60m' && je.price === 1.1 && je.pnl === 125.5 && je.date === '2026-10-12')
check('TP closed in profit → Target Hit', je.status === 'Target Hit')
check('notes carry lots, entry→exit, SL, TP, pips and why it closed', ['0.1 lots', 'entry 1.1 → exit 1.1126', 'SL 1.095', 'TP 1.115', '+126 pips', 'take profit'].every((x) => je.notes.includes(x)), je.notes)
check('SL loss → SL Hit, Sell direction', J.toJournalEntry(T(8, 'GBPUSD', 'sell', -40, 0, 60, { reason: 'sl' })).status === 'SL Hit' && J.toJournalEntry(T(8, 'GBPUSD', 'sell', -40, 0, 60, { reason: 'sl' })).direction === 'Sell')
check('trailing/BE stop that closed in profit counts as Target Hit; manual loss as SL Hit', J.journalStatus(T(1, 'EURUSD', 'buy', 20, 0, 1, { reason: 'sl' })) === 'Target Hit' && J.journalStatus(T(1, 'EURUSD', 'buy', -3, 0, 1, { reason: 'manual' })) === 'SL Hit')
check('stop-out → SL Hit', J.journalStatus(T(1, 'EURUSD', 'buy', -300, 0, 1, { reason: 'stopout' })) === 'SL Hit')
const ji = J.toJournalEntry(T(9, 'NIFTY50', 'buy', 10, 0, 60, {}))
check('index trade: pair "NIFTY 50", P&L converted $→₹ (10 × 83 = 830)', ji.pair === 'NIFTY 50' && ji.instrumentType === 'Index' && ji.pnl === 830 && ji.notes.includes('converted'))
check('timeframe falls back to the terminal chart timeframe, then 15m', J.toJournalEntry(T(1, 'EURUSD', 'buy', 1), { timeframeId: 'H4' }).timeframe === '4h' && J.toJournalEntry(T(1, 'EURUSD', 'buy', 1)).timeframe === '15m')
check('journalKey is unique per trade (id + close time)', J.journalKey(jt) === `h7@${jt.closeTime}` && J.journalKey(jt) !== J.journalKey({ ...jt, closeTime: jt.closeTime + 1 }))
check('approx offline fills are flagged in the notes', J.toJournalEntry(T(1, 'EURUSD', 'buy', 1, 0, 1, { approx: true })).notes.includes('approximate'))

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
