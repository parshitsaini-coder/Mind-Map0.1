// Hand-checked examples for the demo terminal's maths. Run: node tests/terminal-engine.test.mjs
import { INSTRUMENTS } from '../src/lib/terminal/instruments.js'
import * as E from '../src/lib/terminal/engine.js'
import { getCandles, getQuote, subscribe } from '../src/lib/terminal/feed/simulatedFeed.js'

let fail = 0
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name} ${ok ? '' : extra}`) }
const I = INSTRUMENTS
const rates = { USDJPY: 150, USDINR: 83 }

// pip value
check('EURUSD pip value = $10/lot', near(E.pipValuePerLot(I.EURUSD, rates), 10))
check('XAUUSD pip(0.1) value = $10/lot', near(E.pipValuePerLot(I.XAUUSD, rates), 10))
check('USDJPY pip value = 1000 JPY = $6.667', near(E.pipValuePerLot(I.USDJPY, rates), 1000 / 150, 0.001))

// P&L
check('EURUSD buy 1 lot +10 pips = +$100', near(E.pnl('buy', 1, 1.1, 1.101, I.EURUSD, rates), 100))
check('EURUSD sell 1 lot, price +10 pips = -$100', near(E.pnl('sell', 1, 1.1, 1.101, I.EURUSD, rates), -100))
check('XAUUSD buy 1 lot 2000->2010 = +$1000', near(E.pnl('buy', 1, 2000, 2010, I.XAUUSD, rates), 1000))
check('USDJPY buy 1 lot +0.50 = 50000 JPY = $333.33', near(E.pnl('buy', 1, 150, 150.5, I.USDJPY, rates), 50000 / 150, 0.01))
check('NIFTY buy 1 lot +100pts = 100*50 INR = $60.24', near(E.pnl('buy', 1, 22500, 22600, I.NIFTY50, rates), 5000 / 83, 0.01))
check('pips moved EURUSD +10', near(E.pipsMoved('buy', 1.1, 1.101, I.EURUSD), 10, 1e-6))

// margin
check('EURUSD 1 lot @1.10 1:100 margin = $1100', near(E.requiredMargin(1, 1.1, I.EURUSD, 100, rates), 1100))
check('XAUUSD 1 lot @2000 1:100 margin = $2000', near(E.requiredMargin(1, 2000, I.XAUUSD, 100, rates), 2000))
check('USDJPY 1 lot @150 1:100 margin = $1000', near(E.requiredMargin(1, 150, I.USDJPY, 100, rates), 1000))
check('EURUSD 0.1 lot @1.10 1:500 margin = $22', near(E.requiredMargin(0.1, 1.1, I.EURUSD, 500, rates), 22))

// spread
const s = E.applySpread(1.1, 0.0002, 5)
check('spread split around mid', near(s.bid, 1.0999, 1e-9) && near(s.ask, 1.1001, 1e-9), JSON.stringify(s))

// lots from risk
check('risk $100, 20 pips EURUSD -> 0.5 lot', E.lotsFromRisk(100, 20, I.EURUSD, rates) === 0.5)
check('risk $100, 30 pips EURUSD -> 0.33 lot (rounded down)', E.lotsFromRisk(100, 30, I.EURUSD, rates) === 0.33)

// lot validation
check('lot 0.005 rejected', E.validateLots(0.005, I.EURUSD) !== null)
check('lot 0.15 ok', E.validateLots(0.15, I.EURUSD) === null)
check('lot 500 rejected', E.validateLots(500, I.EURUSD) !== null)

// account metrics: buy 1 lot EURUSD @1.1000, bid now 1.0990 (-10 pips)
const m = E.accountMetrics({
  balance: 10000, leverage: 100, rates, instruments: I,
  positions: [{ id: 'a', symbol: 'EURUSD', side: 'buy', lots: 1, entry: 1.1 }],
  quotes: { EURUSD: { bid: 1.099, ask: 1.0992 } },
})
check('floating = -$100', near(m.floating, -100))
check('equity = 9900', near(m.equity, 9900))
check('used margin = 1100', near(m.usedMargin, 1100))
check('free margin = 8800', near(m.freeMargin, 8800))
check('margin level = 900%', near(m.marginLevel, 900, 0.01))
check('no stop-out at 900%', E.stopOutCandidate(m, 50) === null)

// stop-out: balance 700, same trade at -$200 -> equity 500, margin 1100 -> 45%
const m2 = E.accountMetrics({
  balance: 700, leverage: 100, rates, instruments: I,
  positions: [
    { id: 'big', symbol: 'EURUSD', side: 'buy', lots: 1, entry: 1.1 },
    { id: 'small', symbol: 'XAUUSD', side: 'buy', lots: 0.01, entry: 2000 },
  ],
  quotes: { EURUSD: { bid: 1.098, ask: 1.0982 }, XAUUSD: { bid: 2000, ask: 2000.3 } },
})
check('stop-out picks the worst loser', E.stopOutCandidate(m2, 50) === 'big', `ml=${m2.marginLevel}`)

// no positions
const m3 = E.accountMetrics({ balance: 10000, leverage: 100, rates, instruments: I, positions: [], quotes: {} })
check('no positions -> equity=balance, margin level null', m3.equity === 10000 && m3.marginLevel === null)

// ── simulated feed ──
for (const sym of Object.keys(I)) {
  const c = getCandles(sym, 'M15', 500)
  const ok = c.length > 400 && c.every((k) => k.high >= Math.max(k.open, k.close) - 1e-9 && k.low <= Math.min(k.open, k.close) + 1e-9 && k.time > 0)
  const first = getCandles(sym, 'M15', 500)[0].open
  const again = getCandles(sym, 'M15', 500)[0].open
  const base = I[sym].base
  const last = c[c.length - 1].close
  check(`${sym}: ${c.length} valid M15 candles, deterministic, price near base (${last.toFixed(I[sym].digits)})`,
    ok && first === again && Math.abs(last / base - 1) < 0.15)
}
const tfCounts = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((t) => getCandles('EURUSD', t, 5000).length)
check('every timeframe returns candles & higher TF = fewer', tfCounts.every((n) => n > 0) && tfCounts[0] > tfCounts[3] && tfCounts[3] > tfCounts[6], tfCounts.join(','))
const q = getQuote('XAUUSD')
check('quote has bid < ask', q.bid < q.ask && near(q.ask - q.bid, I.XAUUSD.spread, 0.011))
await new Promise((res) => {
  let n = 0
  const un = subscribe('EURUSD', () => { if (++n === 3) { un(); res() } })
})
check('live ticks arrive and can be unsubscribed', true)

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
