// Phase 8 (pure logic): commission, slippage, variable spread, and the hand-checked numbers from the
// final QA checklist (margin / P&L / pip value for forex, gold, JPY and an index; margin block; stop-out;
// bid-vs-ask SL/TP). Plain Node, no browser.
import './fixtures/legacyInstruments.js'
import * as E from '../src/lib/terminal/engine.js'
import * as L from '../src/lib/terminal/ledger.js'
import { INSTRUMENTS } from '../src/lib/terminal/instruments.js'
import { quoteFromMid, setSpreadMode, getSpreadMode, spreadFactor } from '../src/lib/terminal/feed/spread.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol
const Q = (bid, ask) => ({ bid, ask })

// ── QA 1: hand-calculated margin / P&L / pip value ───────────────────────
{
  const eur = INSTRUMENTS.EURUSD, xau = INSTRUMENTS.XAUUSD, jpy = INSTRUMENTS.USDJPY, nif = INSTRUMENTS.NIFTY50
  check('EURUSD: pip value $10 / lot', near(E.pipValuePerLot(eur), 10))
  check('EURUSD: 1 lot, +10 pips = +$100', near(E.pnl('buy', 1, 1.1000, 1.1010, eur), 100))
  check('EURUSD: 1 lot SELL, price +10 pips = −$100', near(E.pnl('sell', 1, 1.1000, 1.1010, eur), -100))
  check('EURUSD: margin 1 lot @1.10, 1:100 = $1,100', near(E.requiredMargin(1, 1.10, eur, 100), 1100))
  check('XAUUSD: 1 lot = 100 oz → +$1 move = +$100', near(E.pnl('buy', 1, 2000, 2001, xau), 100))
  check('XAUUSD: pip (0.1) value $10 / lot', near(E.pipValuePerLot(xau), 10))
  check('XAUUSD: margin 1 lot @2000, 1:100 = $2,000', near(E.requiredMargin(1, 2000, xau, 100), 2000))
  check('USDJPY: pip value = 1000 JPY / 150 = $6.667 / lot', near(E.pipValuePerLot(jpy), 1000 / 150))
  check('USDJPY: 1 lot, +10 pips (0.10) = 10,000 JPY = $66.67', near(E.pnl('buy', 1, 150.00, 150.10, jpy), 10000 / 150))
  check('USDJPY: margin 1 lot @150, 1:100 = $1,000', near(E.requiredMargin(1, 150, jpy, 100), 1000))
  check('NIFTY50: 1 lot × 100 points = 100×50 INR = $60.24 (₹83/$)', near(E.pnl('buy', 1, 22500, 22600, nif), 5000 / 83))
  check('NIFTY50: point value = 50 INR = $0.602 / lot', near(E.pipValuePerLot(nif), 50 / 83, 0.0005))
}

// ── QA 2: insufficient margin blocks with a clear message ────────────────
{
  const l = L.createLedger(10000, 100, 1)
  const r = L.openPosition(l, { symbol: 'EURUSD', side: 'buy', lots: 10 }, { EURUSD: Q(1.0999, 1.1001) }, 5)
  check('10 lots EURUSD on $10k @1:100 is refused with a margin message', !!r.error && /margin/i.test(r.error), r.error)
  const ok = L.openPosition(l, { symbol: 'EURUSD', side: 'buy', lots: 0.5 }, { EURUSD: Q(1.0999, 1.1001) }, 5)
  check('0.5 lot is accepted', !ok.error && ok.ledger.positions.length === 1)
}

// ── QA 3: stop-out closes the WORST position first, below the level ──────
{
  let l = L.createLedger(2000, 100, 1)
  const q0 = { EURUSD: Q(1.0999, 1.1001), GBPUSD: Q(1.3000, 1.3001) }
  l = L.openPosition(l, { symbol: 'EURUSD', side: 'buy', lots: 1 }, q0, 5).ledger
  l = L.openPosition(l, { symbol: 'GBPUSD', side: 'buy', lots: 0.5 }, q0, 6).ledger
  const q1 = { EURUSD: Q(1.0900, 1.0902), GBPUSD: Q(1.2950, 1.2951) } // EUR −$1,011 · GBP −$255 → equity ≈ $734 on $1,750 margin ≈ 42%
  const m = L.metricsFor(l, q1)
  check('setup: margin level is below 50%', m.marginLevel < 50, String(m.marginLevel))
  const r = L.processTick(l, q1, { stopOutLevel: 50, now: 10 })
  const t = r.ledger.history[0]
  check('stop-out closes the worst loser (EURUSD) with reason "stopout"', t.symbol === 'EURUSD' && t.reason === 'stopout')
  check('…and stops once margin level is back above the level (GBPUSD stays open)', r.ledger.positions.length === 1 && r.ledger.positions[0].symbol === 'GBPUSD')
}

// ── QA 4: SL/TP use the correct side of the spread ───────────────────────
{
  const buy = { side: 'buy', sl: 1.0950, tp: 1.1050 }
  const sell = { side: 'sell', sl: 1.1050, tp: 1.0950 }
  check('BUY stop-loss is hit by the BID (ask above SL does nothing)', E.checkSlTp(buy, Q(1.0949, 1.0951)) === 'sl' && E.checkSlTp(buy, Q(1.0951, 1.0949)) === null)
  check('BUY take-profit is hit by the BID', E.checkSlTp(buy, Q(1.1050, 1.1052)) === 'tp' && E.checkSlTp(buy, Q(1.1048, 1.1050)) === null)
  check('SELL stop-loss is hit by the ASK', E.checkSlTp(sell, Q(1.1048, 1.1050)) === 'sl' && E.checkSlTp(sell, Q(1.1050, 1.1048)) === null)
  check('SELL take-profit is hit by the ASK', E.checkSlTp(sell, Q(1.0948, 1.0950)) === 'tp')
  // gap: price jumps far past the stop → fills at the first available price, not at the level
  let l = L.createLedger(10000, 100, 1)
  l = L.openPosition(l, { symbol: 'EURUSD', side: 'buy', lots: 0.1, sl: 1.0950 }, { EURUSD: Q(1.0999, 1.1001) }, 5).ledger
  const r = L.processTick(l, { EURUSD: Q(1.0900, 1.0902) }, { now: 9 })
  check('gap through SL fills at the gapped price (1.0900), not the SL level', r.ledger.history[0].exit === 1.0900 && r.ledger.history[0].reason === 'sl')
}

// ── commission ───────────────────────────────────────────────────────────
{
  const q = { EURUSD: Q(1.0999, 1.1001) }
  const mk = (commission) => {
    let l = L.createLedger(10000, 100, 1)
    if (commission) l = { ...l, account: { ...l.account, commission } }
    return L.openPosition(l, { symbol: 'EURUSD', side: 'buy', lots: 1 }, q, 5).ledger
  }
  const exit = { EURUSD: Q(1.1011, 1.1013) }
  const free = L.closePosition(mk(0), 'p1', exit, { now: 9 })
  const paid = L.closePosition(mk(7), 'p1', exit, { now: 9 })
  check('no commission: P&L unchanged (1.1011 − 1.1001 = 10 pips = $100)', near(free.trade.pnl, 100) && free.trade.commission === undefined)
  check('$7/lot × 1 lot: trade pnl is NET ($93) and records the commission', near(paid.trade.pnl, 93) && paid.trade.commission === 7)
  check('balance moves by the NET amount', near(paid.ledger.account.balance, 10093))
  const part = L.partialClose(mk(7), 'p1', 50, exit, 9)
  check('partial close charges commission only on the lots closed ($3.50 on 0.5)', near(part.trade.pnl, 50 - 3.5) && part.trade.commission === 3.5)
  check('pips are gross (commission is money, not price)', paid.trade.pips === free.trade.pips)
}

// ── slippage ─────────────────────────────────────────────────────────────
{
  const eur = INSTRUMENTS.EURUSD
  check('slippage 0 → fills at the quote', E.applySlippage(true, 1.1001, eur, () => 0) === 1.1001)
  check('max slippage = 0.5 pip against you (buy pays more)', E.applySlippage(true, 1.1001, eur, () => 1) === 1.10015)
  check('…and a sell receives less', E.applySlippage(false, 1.0999, eur, () => 1) === 1.09985)
  let worse = true
  for (let i = 0; i < 2000; i++) {
    const rng = Math.random
    const b = E.applySlippage(true, 1.1001, eur, rng); const s = E.applySlippage(false, 1.0999, eur, rng)
    if (b < 1.1001 || s > 1.0999 || b > 1.10015 + 1e-9 || s < 1.09985 - 1e-9) worse = false
  }
  check('2,000 random fills: never better than the quote, never beyond 0.5 pip', worse)
  const q = E.slipQuote(Q(1.0999, 1.1001), eur, () => 1)
  check('slipQuote worsens both sides', q.bid < 1.0999 && q.ask > 1.1001)
  check('index slippage scales with its own pip (NIFTY: up to 0.5 point)', E.applySlippage(true, 22500, INSTRUMENTS.NIFTY50, () => 1) === 22500.5)
}

// ── spread mode ──────────────────────────────────────────────────────────
{
  const mid = 1.1
  const fixed = quoteFromMid('EURUSD', mid, 1000)
  check('fixed mode: spread = instrument spread', getSpreadMode() === 'fixed' && near(fixed.spread, INSTRUMENTS.EURUSD.spread, 1e-12))
  setSpreadMode('variable')
  const samples = Array.from({ length: 4000 }, (_, i) => spreadFactor('EURUSD', i * 10))
  const min = Math.min(...samples), max = Math.max(...samples)
  const calm = samples.filter((f) => f < 1.25).length / samples.length
  check('variable: never tighter than normal, mostly calm, sometimes wide', min >= 1 && calm > 0.7 && calm < 0.9 && max > 3, `min ${min} calm ${calm} max ${max}`)
  const a = quoteFromMid('EURUSD', mid, 1234), b = quoteFromMid('EURUSD', mid, 1234)
  check('variable spread is deterministic in time (replays see the same spread)', a.spread === b.spread && a.ask - a.bid > 0)
  check('quote bid/ask reflect the variable spread', near(a.ask - a.bid, a.spread, 2e-5))
  setSpreadMode('nonsense')
  check('unknown mode falls back to fixed', getSpreadMode() === 'fixed')
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED')
process.exit(fail ? 1 : 0)
